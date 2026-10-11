import type { BaseUnit, IngredientDef } from "../domain/types";

/**
 * Unit handling.
 *
 * Standard units belong to a dimension (mass or volume) and convert freely
 * within it. Moving between mass, volume and counted items is only allowed when
 * the ingredient supplies the data to do so (density, typical item weight or a
 * custom unit such as "tin"). Anything else returns `null` – we never guess.
 */

export type Dimension = "mass" | "volume" | "count";

interface StdUnit {
  dim: Dimension;
  /** Factor to g (mass), ml (volume) or items (count). */
  factor: number;
}

export const STANDARD_UNITS: Record<string, StdUnit> = {
  g: { dim: "mass", factor: 1 },
  kg: { dim: "mass", factor: 1000 },
  oz: { dim: "mass", factor: 28.3495 },
  lb: { dim: "mass", factor: 453.592 },
  ml: { dim: "volume", factor: 1 },
  l: { dim: "volume", factor: 1000 },
  tsp: { dim: "volume", factor: 5 },
  tbsp: { dim: "volume", factor: 15 },
  cup: { dim: "volume", factor: 250 }, // metric cup, as used in UK/AU recipes
  pint: { dim: "volume", factor: 568 }, // UK imperial pint
  floz: { dim: "volume", factor: 28.41 }, // UK fluid ounce
  item: { dim: "count", factor: 1 },
};

/** Maps the many ways people write units to a canonical unit key. */
const UNIT_ALIASES: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gr: "g", grm: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  ml: "ml", millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml",
  l: "l", litre: "l", litres: "l", liter: "l", liters: "l", ltr: "l",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp", t: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbl: "tbsp", T: "tbsp",
  dsp: "dsp", dessertspoon: "dsp", dessertspoons: "dsp",
  cup: "cup", cups: "cup",
  pint: "pint", pints: "pint", pt: "pint",
  "fl oz": "floz", floz: "floz", "fl. oz": "floz",
  item: "item", items: "item", each: "item", whole: "item", x: "item", "": "item",
  piece: "item", pieces: "item", pc: "item", pcs: "item",
  large: "item", medium: "item", small: "item",
  clove: "clove", cloves: "clove",
  bulb: "bulb", bulbs: "bulb",
  head: "head", heads: "head",
  tin: "tin", tins: "tin", can: "tin", cans: "tin",
  bunch: "bunch", bunches: "bunch",
  handful: "handful", handfuls: "handful",
  pinch: "pinch", pinches: "pinch",
  sprig: "sprig", sprigs: "sprig",
  stick: "stick", sticks: "stick", stalk: "stick", stalks: "stick",
  slice: "slice", slices: "slice",
  rasher: "rasher", rashers: "rasher",
  knob: "knob",
  cube: "cube", cubes: "cube",
  pot: "pot", pots: "pot",
  sheet: "sheet", sheets: "sheet",
  ball: "ball", balls: "ball",
  nest: "nest", nests: "nest",
  thumb: "thumb", cm: "cm",
  tube: "tube", carton: "carton", jar: "jar", jars: "jar", loaf: "loaf", bag: "bag",
  pack: "pack", packs: "pack", packet: "pack", packets: "pack",
};

/** Words that read like units in ingredient lines. */
export const KNOWN_UNIT_WORDS = new Set(Object.keys(UNIT_ALIASES).filter((k) => k.length > 1 && !["large", "medium", "small", "whole", "each", "x"].includes(k)));

export function normaliseUnit(raw: string | undefined | null): string {
  if (raw == null) return "item";
  const trimmed = raw.trim().replace(/\.$/, "");
  if (trimmed === "T") return "tbsp";
  const key = trimmed.toLowerCase();
  return UNIT_ALIASES[key] ?? key;
}

export function unitDimension(unit: string): Dimension | null {
  return STANDARD_UNITS[normaliseUnit(unit)]?.dim ?? null;
}

const BASE_DIM: Record<BaseUnit, Dimension> = { g: "mass", ml: "volume", item: "count" };

/**
 * Convert an amount of an ingredient to the ingredient's base unit.
 * Returns null if no safe conversion exists.
 */
export function toBase(ing: IngredientDef, quantity: number, rawUnit: string): number | null {
  const unit = normaliseUnit(rawUnit);
  // dessertspoon: treat as 10 ml
  if (unit === "dsp") return toBase(ing, quantity * 10, "ml");

  // 1. Ingredient-specific units always win (tin, clove, bunch, tbsp of lemon juice…).
  const custom = ing.customUnits?.[unit];
  if (custom !== undefined) return quantity * custom;

  const std = STANDARD_UNITS[unit];
  if (!std) return null;

  const baseDim = BASE_DIM[ing.baseUnit];
  const amount = quantity * std.factor; // in g, ml or items

  if (std.dim === baseDim) return amount;

  // 2. Cross-dimension conversions require ingredient data.
  const grams = toGrams(ing, amount, std.dim);
  if (grams === null) return null;
  return fromGrams(ing, grams, baseDim);
}

function toGrams(ing: IngredientDef, amount: number, dim: Dimension): number | null {
  if (dim === "mass") return amount;
  if (dim === "volume") return ing.density ? amount * ing.density : null;
  return ing.gramsPerItem ? amount * ing.gramsPerItem : null;
}

function fromGrams(ing: IngredientDef, grams: number, dim: Dimension): number | null {
  if (dim === "mass") return grams;
  if (dim === "volume") return ing.density ? grams / ing.density : null;
  return ing.gramsPerItem ? grams / ing.gramsPerItem : null;
}

/** Convert between two *standard* units of the same dimension (no ingredient data needed). */
export function convertStandard(quantity: number, from: string, to: string): number | null {
  const a = STANDARD_UNITS[normaliseUnit(from)];
  const b = STANDARD_UNITS[normaliseUnit(to)];
  if (!a || !b || a.dim !== b.dim) return null;
  return (quantity * a.factor) / b.factor;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

/** Formats 3.5 → "3½", 0.33 → "⅓", 2.1 → "2.1". */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "?";
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.04) return String(whole);
  if (frac > 0.96) return String(whole + 1);
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.04) return whole === 0 ? s : `${whole}${s}`;
  }
  return n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

/** Human-friendly quantity in an ingredient's base unit. */
export function formatBaseQuantity(qty: number, base: BaseUnit | string, ing?: IngredientDef): string {
  if (base === "g") {
    if (qty >= 1000) return `${formatDecimal(qty / 1000)}kg`;
    if (qty < 10 && ing?.density) return formatSpoons(qty / ing.density) ?? `${formatDecimal(qty)}g`;
    return `${Math.round(qty < 50 ? qty : roundTo(qty, 5))}g`;
  }
  if (base === "ml") {
    if (qty >= 1000) return `${formatDecimal(qty / 1000)} litres`;
    if (qty < 45) return formatSpoons(qty) ?? `${Math.round(qty)}ml`;
    return `${Math.round(roundTo(qty, 5))}ml`;
  }
  if (base === "item") {
    const label = qty === 1 || qty < 1 ? ing?.itemLabel : ing?.itemLabelPlural ?? ing?.itemLabel;
    return label ? `${formatNumber(qty)} ${label}` : formatNumber(qty);
  }
  return `${formatNumber(qty)} ${base}`;
}

function formatDecimal(n: number) {
  return (Math.round(n * 100) / 100).toString();
}

/** 7.5 ml → "1½ tsp", 30 ml → "2 tbsp". */
function formatSpoons(ml: number): string | null {
  if (ml <= 0) return "0";
  if (ml < 0.6) return "a pinch";
  const tbsp = ml / 15;
  if (tbsp >= 1 && Math.abs(tbsp * 2 - Math.round(tbsp * 2)) < 0.15) return `${formatNumber(Math.round(tbsp * 2) / 2)} tbsp`;
  const tsp = ml / 5;
  return `${formatNumber(Math.max(0.25, Math.round(tsp * 4) / 4))} tsp`;
}

/** Formats a recipe-style quantity + unit (e.g. 2 tbsp, 400 g, 3 cloves). */
export function formatRecipeQuantity(qty: number, unit: string, ing?: IngredientDef): string {
  const u = normaliseUnit(unit);
  if (u === "item") {
    if (ing?.itemLabel) return `${formatNumber(qty)} ${qty <= 1 ? ing.itemLabel : ing.itemLabelPlural ?? ing.itemLabel}`;
    return formatNumber(qty);
  }
  if (u === "g" || u === "ml") {
    if (qty >= 1000) return `${formatDecimal(qty / 1000)}${u === "g" ? "kg" : " litres"}`;
    return `${qty < 20 ? formatNumber(qty) : Math.round(qty)}${u}`;
  }
  const plural = qty > 1 && !["g", "kg", "ml", "l", "tsp", "tbsp", "oz", "lb"].includes(u);
  const label = plural ? pluraliseUnit(u) : u;
  return `${formatNumber(qty)} ${label}`;
}

function pluraliseUnit(u: string) {
  if (u === "pinch") return "pinches";
  if (u === "bunch") return "bunches";
  if (u.endsWith("s")) return u;
  return `${u}s`;
}
