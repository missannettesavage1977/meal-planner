import type { Product, Supermarket } from "../domain/types";

/**
 * A pricing provider supplies product/price observations for ingredients.
 *
 * The application only ever reads prices through a synchronous `PriceBook`
 * (see priceBook.ts), which is filled from providers. A future legitimate
 * integration (for example a licensed retail-data API) would implement
 * `PriceProvider.fetchProducts` and cache the results into the price book;
 * nothing in the UI would need to change.
 *
 * No live supermarket integration is implemented. See docs/PRICING.md.
 */
export interface PriceProvider {
  id: string;
  label: string;
  /** True only for data fetched from a retailer or licensed feed at request time. */
  isLive: boolean;
  /** Human description of where the data comes from, shown in the UI. */
  description: string;
  fetchProducts(query: { supermarket: Supermarket; ingredientIds: string[] }): Promise<Product[]>;
}

/** A money estimate in pence with an uncertainty range. */
export interface Estimate {
  pence: number;
  low: number;
  high: number;
  /** Fraction (0–1) of the value backed by any price data. */
  coverage: number;
  sources: Set<Product["source"]>;
}

export const ZERO_ESTIMATE = (): Estimate => ({ pence: 0, low: 0, high: 0, coverage: 1, sources: new Set() });

export function addEstimates(a: Estimate, b: Estimate): Estimate {
  const total = a.pence + b.pence;
  const coverage = total === 0 ? Math.min(a.coverage, b.coverage) : (a.pence * a.coverage + b.pence * b.coverage) / total;
  return {
    pence: total,
    low: a.low + b.low,
    high: a.high + b.high,
    coverage,
    sources: new Set([...a.sources, ...b.sources]),
  };
}

export function scaleEstimate(e: Estimate, f: number): Estimate {
  return { ...e, pence: e.pence * f, low: e.low * f, high: e.high * f, sources: new Set(e.sources) };
}

export const CONFIDENCE_SPREAD: Record<Product["confidence"], number> = {
  high: 0.05,
  medium: 0.12,
  low: 0.25,
};
