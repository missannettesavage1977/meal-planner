import type { AdhocItem, Household, InventoryItem, MealPlan, PlannedMeal, Recipe, ShoppingState } from "../domain/types";
import { PriceBook } from "../pricing/priceBook";
import { addEstimates, ZERO_ESTIMATE, type Estimate } from "../pricing/types";
import { consolidate, planRequirements, recipeRequirements, sumLines, type ShoppingLine } from "./consolidate";
import { applySubstitutions } from "./substitutions";

/**
 * Budget maths. Three distinct quantities are kept apart so nothing is counted twice:
 *
 *   consumption  – value of the food the planned meals actually use (some of it from home)
 *   shopping     – cost of the packs you need to buy (after food at home, rounded to packs)
 *   inventory    – value of food from home that the meals use up
 *
 * Savings are measured on the shopping bill, as three successive steps:
 *   A  each meal bought separately, nothing at home
 *   B  all meals bought together (shared packs), nothing at home   → overlap saving   = A − B
 *   C  all meals together, using food at home (the real list)      → inventory saving = B − C
 */

export interface MealCost {
  meal: PlannedMeal;
  recipe: Recipe;
  /** Value of food used by this meal (cooked meals only; leftovers are covered by their source). */
  consumptionPence: number;
  perPortionPence: number;
  coverage: number;
}

export interface BudgetSummary {
  budgetPence: number;
  scope: Household["budgetScope"];
  consumption: Estimate;
  shopping: Estimate;
  inventoryUsed: Estimate;
  adhocPence: number;
  adhocUnpriced: number;
  /** Total compared with the budget. */
  spendPence: number;
  remainingPence: number;
  overlapSavingPence: number;
  inventorySavingPence: number;
  /** Value of pack contents left over after this week (stays in your cupboard/fridge). */
  surplusValuePence: number;
  mealCosts: MealCost[];
  portions: number;
  costPerPortionPence: number;
  topItems: { key: string; name: string; pence: number; share: number }[];
  unpriced: string[];
  coverage: number;
}

export interface BudgetInput {
  plan: Pick<MealPlan, "meals">;
  recipes: Record<string, Recipe>;
  household: Household;
  inventory: InventoryItem[];
  priceBook: PriceBook;
  shopping?: Partial<ShoppingState>;
  lines?: ShoppingLine[];
}

/** Recipes with each meal's substitutions applied, keyed so planRequirements can find them. */
export function effectivePlan(plan: Pick<MealPlan, "meals">, recipes: Record<string, Recipe>) {
  const effRecipes: Record<string, Recipe> = { ...recipes };
  const meals = plan.meals.map((m) => {
    const r = recipes[m.recipeId];
    if (!r || !m.substitutions || !Object.keys(m.substitutions).length) return m;
    const key = `${m.recipeId}::${m.id}`;
    effRecipes[key] = { ...applySubstitutions(r, m.substitutions), id: r.id };
    return { ...m, recipeId: key };
  });
  return { meals, recipes: effRecipes };
}

export function shoppingLinesFor(input: Omit<BudgetInput, "lines">): ShoppingLine[] {
  const eff = effectivePlan(input.plan, input.recipes);
  return consolidate(planRequirements(eff, eff.recipes), {
    inventory: input.inventory,
    priceBook: input.priceBook,
    supermarket: input.household.supermarket,
    assumeStaples: input.household.assumeStaples,
    cupboardStaples: input.household.cupboardStaples,
    shopping: input.shopping,
  });
}

export function mealConsumptionCost(
  recipe: Recipe,
  servings: number,
  household: Pick<Household, "supermarket">,
  priceBook: PriceBook,
): { pence: number; coverage: number; estimate: Estimate } {
  const lines = consolidate(recipeRequirements(recipe, servings), {
    priceBook,
    supermarket: household.supermarket,
  });
  const est = sumLines(lines, "consumptionCost");
  const pricedLines = lines.filter((l) => l.hasPrice).length;
  return { pence: est.pence, coverage: lines.length ? pricedLines / lines.length : 0, estimate: est };
}

/** Cost of buying everything for one recipe on its own (pack rounding, nothing at home). */
export function standalonePurchaseCost(recipe: Recipe, servings: number, household: Pick<Household, "supermarket" | "assumeStaples" | "cupboardStaples">, priceBook: PriceBook): Estimate {
  const lines = consolidate(recipeRequirements(recipe, servings), {
    priceBook,
    supermarket: household.supermarket,
    assumeStaples: household.assumeStaples,
    cupboardStaples: household.cupboardStaples,
  });
  return sumLines(lines, "purchaseCost");
}

export function computeBudget(input: BudgetInput & { adhoc?: AdhocItem[] }): BudgetSummary {
  const { household: h, priceBook } = input;
  const eff = effectivePlan(input.plan, input.recipes);
  const lines = input.lines ?? shoppingLinesFor(input);

  const consumption = sumLines(lines, "consumptionCost");
  const shopping = sumLines(lines, "purchaseCost");
  const inventoryUsed = sumLines(lines, "inventoryValueUsed");

  // A: each cook meal bought on its own; B: together without inventory.
  const active = eff.meals.filter((m) => m.kind === "cook" && !m.cooked);
  let a = 0;
  for (const m of active) {
    const r = eff.recipes[m.recipeId];
    if (r) a += standalonePurchaseCost(r, m.servings, h, priceBook).pence;
  }
  const togetherNoInventory = consolidate(planRequirements({ meals: active }, eff.recipes), {
    priceBook,
    supermarket: h.supermarket,
    assumeStaples: h.assumeStaples,
    cupboardStaples: h.cupboardStaples,
  });
  const b = sumLines(togetherNoInventory, "purchaseCost").pence;
  // C must be measured without manual edits so the saving reflects inventory only.
  const cLines = input.shopping ? shoppingLinesFor({ ...input, shopping: undefined }) : lines;
  const c = sumLines(cLines, "purchaseCost").pence;

  const adhoc = input.adhoc ?? input.shopping?.adhoc ?? [];
  const adhocPence = adhoc.reduce((s, i) => s + (i.pricePence ?? 0), 0);
  const adhocUnpriced = adhoc.filter((i) => i.pricePence === undefined).length;
  const spend = shopping.pence + (h.budgetScope === "all-groceries" ? adhocPence : 0);

  const mealCosts: MealCost[] = [];
  let portions = 0;
  for (const m of eff.meals) {
    const r = eff.recipes[m.recipeId];
    if (!r) continue;
    if (m.kind === "leftover") {
      const src = eff.meals.find((x) => x.id === m.leftoverOf);
      const srcR = src && eff.recipes[src.recipeId];
      const per = srcR && src ? mealConsumptionCost(srcR, src.servings, h, priceBook).pence / src.servings : 0;
      mealCosts.push({ meal: m, recipe: r, consumptionPence: 0, perPortionPence: per, coverage: 1 });
      continue;
    }
    const c1 = mealConsumptionCost(r, m.servings, h, priceBook);
    mealCosts.push({ meal: m, recipe: r, consumptionPence: c1.pence, perPortionPence: c1.pence / m.servings, coverage: c1.coverage });
    if (!m.cooked) portions += m.servings;
  }

  let surplus = 0;
  for (const l of lines) {
    if (!l.purchase?.priced || l.purchase.surplus <= 0 || !l.ingredientId) continue;
    const up = priceBook.unitPrice(h.supermarket, l.ingredientId);
    if (up) surplus += up.pencePerUnit * l.purchase.surplus;
  }

  const total = shopping.pence || 1;
  const topItems = lines
    .filter((l) => l.purchaseCost.pence > 0)
    .sort((x, y) => y.purchaseCost.pence - x.purchaseCost.pence)
    .slice(0, 5)
    .map((l) => ({ key: l.key, name: l.name, pence: l.purchaseCost.pence, share: l.purchaseCost.pence / total }));

  const unpriced = lines.filter((l) => l.toBuy > 0 && !l.purchase?.priced).map((l) => l.name);
  const activeConsumption = active.reduce((s, m) => {
    const r = eff.recipes[m.recipeId];
    return s + (r ? mealConsumptionCost(r, m.servings, h, priceBook).pence : 0);
  }, 0);

  return {
    budgetPence: h.weeklyBudgetPence,
    scope: h.budgetScope,
    consumption,
    shopping,
    inventoryUsed,
    adhocPence,
    adhocUnpriced,
    spendPence: spend,
    remainingPence: h.weeklyBudgetPence - spend,
    overlapSavingPence: Math.max(0, a - b),
    inventorySavingPence: Math.max(0, b - c),
    surplusValuePence: surplus,
    mealCosts,
    portions,
    costPerPortionPence: portions ? activeConsumption / portions : 0,
    topItems,
    unpriced,
    coverage: lines.length ? lines.filter((l) => l.hasPrice || l.staple).length / lines.length : 1,
  };
}

export function sumEstimates(list: Estimate[]): Estimate {
  return list.reduce(addEstimates, ZERO_ESTIMATE());
}
