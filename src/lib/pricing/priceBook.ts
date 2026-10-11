import { getIngredient } from "../data/ingredients";
import type { Product, Supermarket } from "../domain/types";
import { demoProducts } from "./demoProvider";
import { CONFIDENCE_SPREAD, type Estimate } from "./types";

/**
 * Synchronous lookup of known products and prices.
 *
 * Precedence for a given supermarket + ingredient:
 *   1. Manual prices the user entered (most trusted – they saw the shelf).
 *   2. Provider prices (future legitimate integrations).
 *   3. Demonstration prices.
 * Lower-precedence sources are ignored when a higher one exists, so a demo price
 * never silently undercuts a real observation.
 */
export class PriceBook {
  private bySmIng = new Map<string, Product[]>();

  constructor(products: Product[]) {
    const rank: Record<Product["source"], number> = { manual: 0, provider: 1, demo: 2 };
    const grouped = new Map<string, Product[]>();
    for (const p of products) {
      const k = key(p.supermarket, p.ingredientId);
      const list = grouped.get(k) ?? [];
      list.push(p);
      grouped.set(k, list);
    }
    for (const [k, list] of grouped) {
      const best = Math.min(...list.map((p) => rank[p.source]));
      this.bySmIng.set(
        k,
        list.filter((p) => rank[p.source] === best).sort((a, b) => a.packSize - b.packSize),
      );
    }
  }

  static withDemo(manual: Product[] = []): PriceBook {
    return new PriceBook([...demoProducts(), ...manual]);
  }

  products(supermarket: Supermarket, ingredientId: string | null): Product[] {
    if (!ingredientId) return [];
    return this.bySmIng.get(key(supermarket, ingredientId)) ?? [];
  }

  /** Cheapest unit price (pence per base unit) and the product it comes from. */
  unitPrice(supermarket: Supermarket, ingredientId: string | null): { pencePerUnit: number; product: Product } | null {
    const list = this.products(supermarket, ingredientId);
    if (!list.length) return null;
    let best = list[0];
    for (const p of list) if (p.pricePence / p.packSize < best.pricePence / best.packSize) best = p;
    return { pencePerUnit: best.pricePence / best.packSize, product: best };
  }

  /**
   * Cost of the food actually *consumed* – e.g. 100 g of a 1.5 kg bag of flour
   * costs 100/1500 of the bag. Returns null when there is no price data.
   */
  consumptionCost(supermarket: Supermarket, ingredientId: string | null, baseQty: number): Estimate | null {
    const up = this.unitPrice(supermarket, ingredientId);
    if (!up) return null;
    return estimateFrom(up.pencePerUnit * baseQty, up.product);
  }
}

function key(sm: Supermarket, ingredientId: string) {
  return `${sm}|${ingredientId}`;
}

export function estimateFrom(pence: number, product: Pick<Product, "confidence" | "source">): Estimate {
  const spread = CONFIDENCE_SPREAD[product.confidence];
  return {
    pence,
    low: pence * (1 - spread),
    high: pence * (1 + spread),
    coverage: 1,
    sources: new Set([product.source]),
  };
}

export function unpricedEstimate(): Estimate {
  return { pence: 0, low: 0, high: 0, coverage: 0, sources: new Set() };
}

/* ------------------------------------------------------------------ */
/* Pack selection                                                      */
/* ------------------------------------------------------------------ */

export interface PackChoice {
  label: string;
  size: number;
  count: number;
  pricePence?: number;
  productId?: string;
  product?: Product;
}

export interface PurchasePlan {
  packs: PackChoice[];
  /** Total quantity bought, in base units. */
  quantity: number;
  /** Total cost in pence; undefined when no price data exists. */
  costPence?: number;
  /** Quantity left over after this week's needs, in base units. */
  surplus: number;
  priced: boolean;
}

interface Option {
  size: number;
  label: string;
  cost: number; // pence, or a proxy (size) when unpriced
  product?: Product;
}

/**
 * Chooses the cheapest combination of packs that covers `need` (base units).
 * Ties are broken by least surplus, then by fewest packs.
 * With no price data, falls back to the catalogue's typical pack sizes and
 * minimises surplus instead of cost.
 */
export function choosePacks(
  need: number,
  products: Product[],
  fallbackPacks: { size: number; label: string }[] = [],
): PurchasePlan | null {
  if (need <= 1e-9) return { packs: [], quantity: 0, costPence: products.length ? 0 : undefined, surplus: 0, priced: products.length > 0 };
  const priced = products.length > 0;
  const options: Option[] = priced
    ? products.map((p) => ({ size: p.packSize, label: p.packLabel, cost: p.pricePence, product: p }))
    : fallbackPacks.map((p) => ({ size: p.size, label: p.label, cost: p.size }));
  if (!options.length) return null;

  const MAX_PACKS = 60;
  let best: { counts: number[]; cost: number; qty: number; n: number } | null = null;

  const counts = new Array(options.length).fill(0);
  const search = (i: number, qty: number, cost: number, n: number) => {
    if (n > MAX_PACKS) return;
    if (best && cost > best.cost + 1e-9) return;
    if (qty >= need - 1e-9) {
      if (
        !best ||
        cost < best.cost - 1e-9 ||
        (Math.abs(cost - best.cost) < 1e-9 && (qty < best.qty - 1e-9 || (Math.abs(qty - best.qty) < 1e-9 && n < best.n)))
      ) {
        best = { counts: [...counts], cost, qty, n };
      }
      return;
    }
    if (i >= options.length) return;
    const o = options[i];
    const maxCount = Math.ceil((need - qty) / o.size);
    for (let c = maxCount; c >= 0; c--) {
      counts[i] = c;
      search(i + 1, qty + c * o.size, cost + c * o.cost, n + c);
    }
    counts[i] = 0;
  };
  search(0, 0, 0, 0);
  if (!best) return null;
  const chosen = best as { counts: number[]; cost: number; qty: number; n: number };

  const packs: PackChoice[] = options
    .map((o, idx) => ({
      label: o.label,
      size: o.size,
      count: chosen.counts[idx],
      pricePence: o.product?.pricePence,
      productId: o.product?.id,
      product: o.product,
    }))
    .filter((p) => p.count > 0);

  return {
    packs,
    quantity: chosen.qty,
    costPence: priced ? chosen.cost : undefined,
    surplus: chosen.qty - need,
    priced,
  };
}

/** Purchase plan for an ingredient at a supermarket, falling back to catalogue pack sizes. */
export function purchasePlanFor(
  book: PriceBook,
  supermarket: Supermarket,
  ingredientId: string | null,
  need: number,
): PurchasePlan | null {
  const products = book.products(supermarket, ingredientId);
  const ing = getIngredient(ingredientId);
  return choosePacks(need, products, ing?.packs ?? []);
}

export function purchaseEstimate(plan: PurchasePlan | null): Estimate | null {
  if (!plan || !plan.priced || plan.costPence === undefined) return null;
  let pence = 0;
  let low = 0;
  let high = 0;
  const sources = new Set<Product["source"]>();
  for (const p of plan.packs) {
    if (!p.product) continue;
    const e = estimateFrom(p.product.pricePence * p.count, p.product);
    pence += e.pence;
    low += e.low;
    high += e.high;
    sources.add(p.product.source);
  }
  return { pence, low, high, coverage: 1, sources };
}
