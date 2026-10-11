import { getIngredient } from "../data/ingredients";
import type {
  Category,
  IngredientDef,
  InventoryItem,
  MealPlan,
  Recipe,
  RecipeIngredient,
  ShoppingState,
  Supermarket,
} from "../domain/types";
import { PriceBook, purchaseEstimate, purchasePlanFor, unpricedEstimate, type PurchasePlan } from "../pricing/priceBook";
import { addEstimates, ZERO_ESTIMATE, type Estimate } from "../pricing/types";
import { freeTextKey, matchIngredient } from "./normalise";
import { convertStandard, formatRecipeQuantity, normaliseUnit, STANDARD_UNITS, toBase } from "./units";

/* ------------------------------------------------------------------ */
/* Requirements                                                        */
/* ------------------------------------------------------------------ */

/** One ingredient need from one meal, already scaled to planned servings. */
export interface Requirement {
  ingredientId: string | null;
  name: string;
  quantity: number;
  unit: string;
  recipeId: string;
  recipeName: string;
  mealId?: string;
  optional?: boolean;
}

/** Scale factor between a recipe's own servings and the servings planned. */
export function scaleFactor(recipe: Pick<Recipe, "servings">, servings: number): number {
  return servings / recipe.servings;
}

export function scaleIngredient(ing: RecipeIngredient, factor: number): RecipeIngredient {
  return { ...ing, quantity: ing.quantity * factor };
}

export function recipeRequirements(recipe: Recipe, servings: number, mealId?: string): Requirement[] {
  const f = scaleFactor(recipe, servings);
  return recipe.ingredients
    .filter((i) => i.quantity > 0 || i.unit !== "")
    .map((i) => ({
      ingredientId: i.ingredientId ?? matchIngredient(i.name)?.id ?? null,
      name: i.name,
      quantity: i.quantity * f,
      unit: i.unit,
      recipeId: recipe.id,
      recipeName: recipe.name,
      mealId,
      optional: i.optional,
    }));
}

/**
 * All ingredient requirements for a plan. Leftover meals add nothing (their food
 * was cooked with the original meal) and cooked meals are already bought.
 */
export function planRequirements(
  plan: Pick<MealPlan, "meals">,
  recipes: Record<string, Recipe>,
  opts: { includeCooked?: boolean } = {},
): Requirement[] {
  const out: Requirement[] = [];
  for (const meal of plan.meals) {
    if (meal.kind === "leftover") continue;
    if (meal.cooked && !opts.includeCooked) continue;
    const recipe = recipes[meal.recipeId];
    if (!recipe) continue;
    out.push(...recipeRequirements(recipe, meal.servings, meal.id));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Consolidated lines                                                  */
/* ------------------------------------------------------------------ */

export interface LineRecipeUse {
  recipeId: string;
  recipeName: string;
  mealIds: string[];
  text: string;
}

export interface ShoppingLine {
  key: string;
  ingredientId: string | null;
  name: string;
  category: Category;
  /** Base unit of the quantities below: "g", "ml", "item", or an unconvertible unit. */
  unit: string;
  required: number;
  available: number;
  /** Quantity still needed after inventory. */
  shortfall: number;
  /** Quantity the user will buy (shortfall, or a manual override). */
  toBuy: number;
  /** Inventory has this but no amount was recorded – assumed sufficient. */
  coveredByUnknownInventory: boolean;
  staple: boolean;
  owned: boolean;
  checked: boolean;
  overridden: boolean;
  purchase: PurchasePlan | null;
  /** Value of the food this week's meals will use (whether bought or not). */
  consumptionCost: Estimate;
  /** Cost of packs to buy. */
  purchaseCost: Estimate;
  /** Value of inventory that this week's meals use up. */
  inventoryValueUsed: Estimate;
  hasPrice: boolean;
  recipes: LineRecipeUse[];
  warnings: string[];
  optionalOnly: boolean;
  ingredient?: IngredientDef;
}

export interface ConsolidateOptions {
  inventory?: InventoryItem[];
  priceBook: PriceBook;
  supermarket: Supermarket;
  assumeStaples?: boolean;
  /** Ingredient ids treated as always in stock when assumeStaples is on. Defaults to catalogue staples. */
  cupboardStaples?: string[];
  shopping?: Partial<ShoppingState>;
}

interface Bucket {
  key: string;
  ingredientId: string | null;
  ingredient?: IngredientDef;
  name: string;
  unit: string;
  required: number;
  recipes: Map<string, LineRecipeUse>;
  warnings: Set<string>;
  allOptional: boolean;
}

/**
 * Combines requirements into one line per ingredient, converting units where it
 * is safe to do so. Requirements that cannot be converted to the ingredient's
 * base unit get their own line rather than being merged incorrectly.
 */
export function mergeRequirements(reqs: Requirement[]): Bucket[] {
  const buckets = new Map<string, Bucket>();
  const failed = new Map<string, Set<string>>();

  for (const r of reqs) {
    const ing = getIngredient(r.ingredientId);
    let key: string;
    let unit: string;
    let qty: number;
    if (ing) {
      const base = toBase(ing, r.quantity, r.unit);
      if (base !== null) {
        key = ing.id;
        unit = ing.baseUnit;
        qty = base;
      } else {
        const u = normaliseUnit(r.unit);
        key = `${ing.id}|${u}`;
        unit = u;
        qty = r.quantity;
        const set = failed.get(ing.id) ?? new Set();
        set.add(u);
        failed.set(ing.id, set);
      }
    } else {
      // Free-text ingredient: merge only identical names, converting within a standard dimension.
      const u = normaliseUnit(r.unit);
      const std = STANDARD_UNITS[u];
      const nameKey = freeTextKey(r.name);
      if (std && std.dim !== "count") {
        unit = std.dim === "mass" ? "g" : "ml";
        qty = convertStandard(r.quantity, u, unit) ?? r.quantity;
      } else {
        unit = u;
        qty = r.quantity;
      }
      key = `text:${nameKey}|${unit}`;
    }

    let b = buckets.get(key);
    if (!b) {
      b = {
        key,
        ingredientId: ing?.id ?? null,
        ingredient: ing,
        name: ing ? ing.name : r.name.trim(),
        unit,
        required: 0,
        recipes: new Map(),
        warnings: new Set(),
        allOptional: true,
      };
      buckets.set(key, b);
    }
    b.required += qty;
    if (!r.optional) b.allOptional = false;
    const use = b.recipes.get(r.recipeId) ?? { recipeId: r.recipeId, recipeName: r.recipeName, mealIds: [], text: "" };
    if (r.mealId) use.mealIds.push(r.mealId);
    b.recipes.set(r.recipeId, use);
    // track per-recipe quantity text in original units
    const prev = (use as LineRecipeUse & { _q?: Record<string, number> })._q ?? {};
    const u = normaliseUnit(r.unit);
    prev[u] = (prev[u] ?? 0) + r.quantity;
    (use as LineRecipeUse & { _q?: Record<string, number> })._q = prev;
  }

  for (const [id, units] of failed) {
    const ing = getIngredient(id)!;
    for (const b of buckets.values()) {
      if (b.ingredientId === id) {
        b.warnings.add(
          `Some recipes measure ${ing.name} in ${[...units].join(", ")}, which can't be safely converted to ${ing.baseUnit === "item" ? "items" : ing.baseUnit}; listed separately.`,
        );
      }
    }
  }

  for (const b of buckets.values()) {
    for (const use of b.recipes.values()) {
      const q = (use as LineRecipeUse & { _q?: Record<string, number> })._q ?? {};
      use.text = Object.entries(q)
        .map(([u, n]) => formatRecipeQuantity(n, u, b.ingredient))
        .join(" + ");
      delete (use as LineRecipeUse & { _q?: Record<string, number> })._q;
    }
  }
  return [...buckets.values()];
}

/** Matches inventory items to catalogue ids (or free-text keys). */
export function inventoryKey(item: Pick<InventoryItem, "ingredientId" | "name">): string {
  const id = item.ingredientId ?? matchIngredient(item.name)?.id ?? null;
  return id ?? `text:${freeTextKey(item.name)}`;
}

interface Availability {
  qty: number;
  unknown: boolean;
  unconverted: string[];
}

/**
 * Total inventory per ingredient, converted to the ingredient's base unit.
 * Free-text items are keyed by name *and* unit dimension (text:name|g) so that
 * grams are never compared with millilitres; "have some" flags use text:name.
 */
export function inventoryAvailability(inventory: InventoryItem[]): Map<string, Availability> {
  const out = new Map<string, Availability>();
  const get = (k: string) => {
    const a = out.get(k) ?? { qty: 0, unknown: false, unconverted: [] };
    out.set(k, a);
    return a;
  };
  for (const item of inventory) {
    const key = inventoryKey(item);
    if (item.quantity === null) {
      get(key).unknown = true;
      continue;
    }
    const amount = item.quantity * (item.remaining ?? 1);
    const ing = getIngredient(key);
    if (ing) {
      const base = toBase(ing, amount, item.unit);
      if (base === null) get(key).unconverted.push(`${formatRecipeQuantity(amount, item.unit)}`);
      else get(key).qty += base;
    } else {
      const u = normaliseUnit(item.unit);
      const std = STANDARD_UNITS[u];
      const unitKey = std ? (std.dim === "mass" ? "g" : std.dim === "volume" ? "ml" : "item") : u;
      get(`${key}|${unitKey}`).qty += std ? amount * std.factor : amount;
    }
  }
  return out;
}

/**
 * Builds the consolidated shopping list:
 *  required → minus inventory → purchase rounding → cost estimates.
 */
export function consolidate(reqs: Requirement[], opts: ConsolidateOptions): ShoppingLine[] {
  const buckets = mergeRequirements(reqs);
  const avail = inventoryAvailability(opts.inventory ?? []);
  const remaining = new Map<string, Availability>();
  for (const [k, v] of avail) remaining.set(k, { ...v });
  const shopping = opts.shopping ?? {};

  // Primary (base-unit) buckets claim inventory before unconvertible ones.
  const ordered = [...buckets].sort((a, b) => Number(a.key.includes("|")) - Number(b.key.includes("|")));

  const lines: ShoppingLine[] = [];
  for (const b of ordered) {
    const ing = b.ingredient;
    // Catalogue items: one availability record per id, claimed by the base-unit line.
    // Free-text items: availability keyed by name + unit, plus a name-only "have some" flag.
    const isPrimary = !b.ingredientId || !b.key.includes("|");
    const inv = b.ingredientId ? remaining.get(b.ingredientId) : remaining.get(b.key);
    const unknownFlag = b.ingredientId ? inv?.unknown : remaining.get(b.key.split("|")[0])?.unknown;
    const warnings = [...b.warnings];

    let available = 0;
    const unknownCover = Boolean(unknownFlag);
    if (inv) {
      if (isPrimary && inv.qty > 0) {
        available = Math.min(inv.qty, b.required);
        inv.qty -= available;
      }
      if (inv.unconverted.length && isPrimary) {
        warnings.push(`My Food has ${inv.unconverted.join(", ")} which couldn't be compared – check before buying.`);
      }
    }

    const staple = Boolean(
      opts.assumeStaples && ing && (opts.cupboardStaples ? opts.cupboardStaples.includes(ing.id) : ing.staple),
    );
    const owned = Boolean(shopping.owned?.[b.key]);
    const shortfall = unknownCover ? 0 : Math.max(0, b.required - available);
    const override = shopping.overrides?.[b.key];
    const overridden = override !== undefined;
    let toBuy = overridden ? override : shortfall;
    if (owned || (staple && !overridden)) toBuy = 0;

    const book = opts.priceBook;
    const sm = opts.supermarket;
    const canPrice = Boolean(b.ingredientId) && !b.key.includes("|");
    const purchase = canPrice ? purchasePlanFor(book, sm, b.ingredientId, toBuy) : null;
    const purchaseCost = purchaseEstimate(purchase) ?? (toBuy > 0 ? unpricedEstimate() : ZERO_ESTIMATE());
    const consumption = canPrice ? book.consumptionCost(sm, b.ingredientId, b.required) : null;
    const invValue = canPrice && available > 0 ? book.consumptionCost(sm, b.ingredientId, available) : null;

    lines.push({
      key: b.key,
      ingredientId: b.ingredientId,
      name: b.name,
      category: ing?.category ?? guessCategory(b.name),
      unit: b.unit,
      required: b.required,
      available,
      shortfall,
      toBuy,
      coveredByUnknownInventory: unknownCover,
      staple,
      owned,
      checked: Boolean(shopping.checked?.[b.key]),
      overridden,
      purchase,
      consumptionCost: consumption ?? unpricedEstimate(),
      purchaseCost,
      inventoryValueUsed: invValue ?? (available > 0 ? unpricedEstimate() : ZERO_ESTIMATE()),
      hasPrice: Boolean(consumption),
      recipes: [...b.recipes.values()],
      warnings,
      optionalOnly: b.allOptional,
      ingredient: ing,
    });
  }

  return lines.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** Sums an estimate field across lines. */
export function sumLines(lines: ShoppingLine[], field: "consumptionCost" | "purchaseCost" | "inventoryValueUsed"): Estimate {
  return lines.reduce((acc, l) => addEstimates(acc, l[field]), ZERO_ESTIMATE());
}

const CATEGORY_HINTS: [RegExp, Category][] = [
  [/(chicken|beef|pork|lamb|mince|sausage|bacon|ham|turkey|steak|chorizo)/, "Meat & poultry"],
  [/(salmon|cod|haddock|tuna|prawn|fish|mackerel|crab|mussel)/, "Fish & seafood"],
  [/(milk|cheese|butter|yog|cream|egg)/, "Dairy & eggs"],
  [/(bread|roll|bagel|pitta|wrap|naan|crumpet|muffin)/, "Bakery"],
  [/(frozen|ice)/, "Frozen"],
  [/(rice|pasta|noodle|couscous|quinoa|spaghetti|lentil)/, "Pasta, rice & grains"],
  [/(tin|tinned|bean|tomato puree|passata|jar)/, "Tins & jars"],
  [/(oil|sauce|vinegar|ketchup|mustard|mayo|stock)/, "Oils, sauces & condiments"],
  [/(cumin|paprika|spice|seasoning|cinnamon|oregano|thyme|chilli powder)/, "Herbs & spices"],
  [/(flour|sugar|oat|cereal|baking)/, "Baking & cereals"],
  [/(apple|banana|onion|potato|carrot|lettuce|pepper|tomato|lemon|lime|fruit|veg|berry|grape|orange|pear|garlic|ginger|cabbage|kale|leek)/, "Fruit & veg"],
];

export function guessCategory(name: string): Category {
  const n = name.toLowerCase();
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(n)) return cat;
  return "Other";
}
