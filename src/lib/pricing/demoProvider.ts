import { DEMO_PACK_PRICES, INGREDIENT_BY_ID } from "../data/ingredients";
import { SUPERMARKETS, SUPERMARKET_LABELS, type Product, type Supermarket } from "../domain/types";
import type { PriceProvider } from "./types";

/**
 * Relative price level used to derive illustrative per-store demo prices from one
 * baseline. These multipliers are rough assumptions for demonstration only.
 */
export const DEMO_STORE_FACTOR: Record<Supermarket, number> = {
  aldi: 0.87,
  lidl: 0.87,
  asda: 0.94,
  tesco: 1,
  morrisons: 1,
  sainsburys: 1.05,
};

let cache: Product[] | null = null;

/** All demonstration products across every supermarket. */
export function demoProducts(): Product[] {
  if (cache) return cache;
  const out: Product[] = [];
  for (const sm of SUPERMARKETS) {
    for (const [ingredientId, packs] of Object.entries(DEMO_PACK_PRICES)) {
      const ing = INGREDIENT_BY_ID[ingredientId];
      for (const [size, label, pence] of packs) {
        out.push({
          id: `demo:${sm}:${ingredientId}:${size}`,
          supermarket: sm,
          ingredientId,
          name: `${capitalise(ing.name)} – ${label}`,
          brand: `${SUPERMARKET_LABELS[sm]} own brand (illustrative)`,
          ownBrand: true,
          packSize: size,
          packLabel: label,
          pricePence: Math.max(1, Math.round(pence * DEMO_STORE_FACTOR[sm])),
          source: "demo",
          confidence: "low",
        });
      }
    }
  }
  cache = out;
  return out;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const demoPriceProvider: PriceProvider = {
  id: "demo",
  label: "Demonstration prices",
  isLive: false,
  description:
    "Hand-estimated illustrative UK prices bundled with the app. They have not been checked against any retailer and will differ from real shelf prices.",
  async fetchProducts({ supermarket, ingredientIds }) {
    const wanted = new Set(ingredientIds);
    return demoProducts().filter((p) => p.supermarket === supermarket && wanted.has(p.ingredientId));
  },
};
