import { getIngredient } from "../data/ingredients";
import {
  CUISINE_LABELS,
  type Household,
  type InventoryItem,
  type MealPlan,
  type MealSlot,
  type PlannedMeal,
  type PlannerWeights,
  type Recipe,
} from "../domain/types";
import { PriceBook } from "../pricing/priceBook";
import { addDays, daysBetween, formatDayShort, isWeekend, parseISO } from "../utils/dates";
import { formatPence } from "../utils/money";
import { newId } from "../utils/ids";
import { consolidate, inventoryKey, planRequirements, sumLines, type ShoppingLine } from "./consolidate";
import { analyseRecipe, checkSuitability } from "./recipeMeta";
import { applySubstitutions, type MealSubstitutions } from "./substitutions";

/**
 * Deterministic, explainable meal-planning engine.
 *
 * Each candidate recipe gets a 0–1 score per criterion; the overall score is a
 * weighted average using the household's configurable weights (adjusted by its
 * stated priorities). Allergies, diets, dislikes and equipment are hard filters
 * applied *before* scoring – a high score can never override them.
 */

export interface PlannerContext {
  household: Household;
  recipes: Recipe[];
  inventory: InventoryItem[];
  priceBook: PriceBook;
  /** ISO date treated as "today" (for expiry calculations). */
  today: string;
  seed?: number;
}

export type Criterion = keyof PlannerWeights;

export interface ScoredCandidate {
  recipe: Recipe;
  score: number;
  breakdown: Record<Criterion, number>;
  reasons: string[];
  /** Extra shopping cost of adding this meal to the plan, in pence. */
  marginalCostPence: number;
  /** Value of food the meal consumes, in pence. */
  consumptionPence: number;
  portions: number;
}

export const CRITERION_LABELS: Record<Criterion, string> = {
  preference: "Your tastes",
  cost: "Cost",
  inventory: "Uses food you have",
  overlap: "Shares fresh ingredients",
  waste: "Less food waste",
  time: "Fits your time",
  variety: "Variety",
  health: "Healthy balance",
  priceConfidence: "Price data quality",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function effectiveWeights(h: Household): PlannerWeights {
  const w = { ...h.weights };
  const p = h.priorities;
  const f = (n: number) => 0.5 + n / 2; // 0→0.5×, 2→1.5×, 3→2×
  w.cost *= f(p.savings);
  w.waste *= f(p.savings) * 0.8 + 0.2;
  w.time *= f(p.convenience);
  w.variety *= f(p.variety);
  w.health *= f(p.health);
  return w;
}

const SHORT_SHELF_DAYS = 7;
const PERISHABLE_DAYS = 10;

function isPerishable(id: string): boolean {
  const ing = getIngredient(id);
  return Boolean(ing && !ing.staple && ing.shelfLifeDays <= PERISHABLE_DAYS);
}

function effectiveRecipe(meal: PlannedMeal & { substitutions?: MealSubstitutions }, recipes: Record<string, Recipe>) {
  const r = recipes[meal.recipeId];
  return r ? applySubstitutions(r, meal.substitutions) : undefined;
}

interface Summary {
  lines: ShoppingLine[];
  cost: number;
  wastePence: number;
  inventoryValue: number;
}

function summarise(ctx: PlannerContext, meals: PlannedMeal[], recipesById: Record<string, Recipe>): Summary {
  const effective: Record<string, Recipe> = { ...recipesById };
  const ms = meals.map((m) => {
    const r = effectiveRecipe(m, recipesById);
    if (r && r !== recipesById[m.recipeId]) {
      const key = `${m.recipeId}::${m.id}`;
      effective[key] = r;
      return { ...m, recipeId: key };
    }
    return m;
  });
  const reqs = planRequirements({ meals: ms }, effective);
  const lines = consolidate(reqs, {
    inventory: ctx.inventory,
    priceBook: ctx.priceBook,
    supermarket: ctx.household.supermarket,
    assumeStaples: ctx.household.assumeStaples,
    cupboardStaples: ctx.household.cupboardStaples,
  });
  let wastePence = 0;
  for (const l of lines) {
    const ing = l.ingredient;
    if (!ing || !l.purchase?.priced || l.purchase.surplus <= 0) continue;
    if (ing.shelfLifeDays > SHORT_SHELF_DAYS) continue;
    const up = ctx.priceBook.unitPrice(ctx.household.supermarket, ing.id);
    if (up) wastePence += l.purchase.surplus * up.pencePerUnit;
  }
  return {
    lines,
    cost: sumLines(lines, "purchaseCost").pence,
    wastePence,
    inventoryValue: sumLines(lines, "inventoryValueUsed").pence,
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Target spend per portion implied by the budget. */
export function targetPerPortion(h: Household): number {
  const mealsPerWeek = Math.max(1, h.planDays.length * h.slots.length);
  const budgetForMeals = h.budgetScope === "all-groceries" ? h.weeklyBudgetPence * 0.75 : h.weeklyBudgetPence;
  const t = budgetForMeals / (mealsPerWeek * h.portionsPerMeal);
  return Math.max(50, t || 250);
}

function timeLimit(h: Household, date: string, slot: MealSlot): number {
  const base = isWeekend(date) ? h.weekendMaxMins : h.weeknightMaxMins;
  if (slot === "breakfast") return Math.min(base, isWeekend(date) ? 40 : 15);
  if (slot === "lunch") return Math.min(base, isWeekend(date) ? 60 : 20);
  return base;
}

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

export function eligibleRecipes(ctx: PlannerContext, slot?: MealSlot): Recipe[] {
  return ctx.recipes.filter((r) => (!slot || r.mealTypes.includes(slot)) && checkSuitability(r, ctx.household).ok);
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

interface ScoringState {
  meals: PlannedMeal[];
  summary: Summary;
  recipesById: Record<string, Recipe>;
  favouriteTokens: string[];
}

function makeState(ctx: PlannerContext, meals: PlannedMeal[], recipesById: Record<string, Recipe>): ScoringState {
  const favouriteTokens = ctx.household.favourites
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return { meals, summary: summarise(ctx, meals, recipesById), recipesById, favouriteTokens };
}

function inventoryIndex(inv: InventoryItem[]) {
  const map = new Map<string, InventoryItem[]>();
  for (const item of inv) {
    const k = inventoryKey(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

export function scoreCandidate(
  ctx: PlannerContext,
  state: ScoringState,
  recipe: Recipe,
  date: string,
  slot: MealSlot,
  servings = ctx.household.portionsPerMeal,
): ScoredCandidate {
  const h = ctx.household;
  const a = analyseRecipe(recipe);
  const reasons: { text: string; weight: number }[] = [];
  const meal: PlannedMeal = { id: "__candidate", date, slot, recipeId: recipe.id, servings, locked: false, cooked: false, kind: "cook" };
  const after = summarise(ctx, [...state.meals, meal], { ...state.recipesById, [recipe.id]: recipe });
  const marginal = Math.max(0, after.cost - state.summary.cost);
  const perPortion = marginal / servings;

  // Consumption value of the meal itself (for display)
  const own = summarise({ ...ctx, inventory: [] }, [meal], { [recipe.id]: recipe });
  const consumptionPence = sumLines(own.lines, "consumptionCost").pence;

  /* preference */
  let preference = 0.5;
  if (h.cuisines.length) {
    if (recipe.cuisine !== "other" && h.cuisines.includes(recipe.cuisine)) {
      preference += 0.3;
      reasons.push({ text: `${CUISINE_LABELS[recipe.cuisine]} – one of your favourite cuisines`, weight: 0.5 });
    } else preference -= 0.1;
  }
  const lowerName = recipe.name.toLowerCase();
  const fav = state.favouriteTokens.find((t) => lowerName.includes(t) || t.split(" ").every((w) => lowerName.includes(w)));
  if (fav) {
    preference += 0.4;
    reasons.push({ text: `You said you love ${fav}`, weight: 1 });
  }
  if (h.children > 0 && recipe.tags.includes("family-friendly")) preference += 0.15;
  // Batch-cooking households: favour dishes that keep, early in the week, so leftovers can be planned.
  const wantsLeftovers = h.batchCooking && h.leftoversPerWeek > state.meals.filter((m) => m.kind === "leftover").length;
  if (wantsLeftovers && recipe.keepsDays >= 2 && slot !== "breakfast" && !isWeekend(date)) {
    preference += 0.2;
    reasons.push({ text: `Keeps ${recipe.keepsDays} days – good for planned leftovers`, weight: 0.35 });
  }
  const suit = checkSuitability(recipe, h);
  if (suit.warnings.length) preference -= 0.1;
  preference = clamp01(preference);

  /* cost (marginal shopping cost per portion vs budget target) */
  const target = targetPerPortion(h);
  const cost = clamp01(1 - perPortion / (2 * target));
  if (perPortion <= target * 0.6) reasons.push({ text: `Only about ${formatPence(perPortion)} a portion extra to buy`, weight: 0.6 });

  /* inventory – value of food at home this meal uses that isn't already allocated */
  const invGain = Math.max(0, after.inventoryValue - state.summary.inventoryValue);
  let inventory = clamp01(invGain / Math.max(60, consumptionPence * 0.35)) * 0.6;
  const idx = inventoryIndex(ctx.inventory);
  const usedHome: string[] = [];
  let expiringBonus = 0;
  for (const id of new Set(a.ingredientIds)) {
    const items = idx.get(id);
    if (!items) continue;
    const ing = getIngredient(id);
    if (ing?.staple) continue;
    usedHome.push(ing?.name ?? id);
    for (const it of items) {
      if (!it.date) continue;
      const daysLeft = daysBetween(ctx.today, it.date);
      const daysToMeal = daysBetween(ctx.today, date);
      if (it.dateType === "use-by" && daysToMeal > daysLeft) continue; // would be past its use-by
      if (daysLeft <= 4) expiringBonus = Math.max(expiringBonus, daysLeft <= 1 ? 1 : 0.7);
      if (daysLeft <= 4 && daysToMeal <= daysLeft) {
        reasons.push({ text: `Uses your ${it.name} before its ${it.dateType ?? "date"} (${formatDayShort(it.date)})`, weight: 2 });
      }
    }
  }
  inventory = clamp01(inventory + 0.4 * expiringBonus + (usedHome.length && invGain === 0 && idx.size ? 0.1 : 0));
  if (usedHome.length && !reasons.some((r) => r.text.startsWith("Uses your"))) {
    reasons.push({ text: `Uses ${listNames(usedHome)} from My Food`, weight: 1.2 });
  }

  /* overlap – fresh ingredients shared with other planned meals */
  const plannedFresh = new Map<string, PlannedMeal>();
  for (const m of state.meals) {
    if (m.kind === "leftover") continue;
    const r = state.recipesById[m.recipeId];
    if (!r) continue;
    for (const id of analyseRecipe(r).ingredientIds) if (isPerishable(id) && !plannedFresh.has(id)) plannedFresh.set(id, m);
  }
  const fresh = [...new Set(a.ingredientIds.filter(isPerishable))];
  const shared = fresh.filter((id) => plannedFresh.has(id));
  const overlap = fresh.length ? clamp01(shared.length / Math.min(fresh.length, 4)) : 0.5;
  if (shared.length) {
    const m = plannedFresh.get(shared[0])!;
    const otherName = state.recipesById[m.recipeId]?.name ?? "another meal";
    reasons.push({
      text: `Shares ${listNames(shared.map((id) => getIngredient(id)?.name ?? id))} with ${formatDayShort(m.date)}'s ${shortName(otherName)}`,
      weight: 0.9 + shared.length * 0.2,
    });
  }

  /* waste – change in leftover perishable packaging */
  const wasteDelta = after.wastePence - state.summary.wastePence;
  const waste = clamp01(0.6 - wasteDelta / 200);
  if (wasteDelta < -20) reasons.push({ text: "Uses up part-packs already on your list", weight: 1.1 });

  /* time */
  const limit = timeLimit(h, date, slot);
  const mins = a.activeMins;
  let time = mins <= limit ? 1 - 0.4 * (mins / limit) : Math.max(0, 0.5 - (mins - limit) / limit);
  if (h.skill === "beginner" && recipe.difficulty === "confident") time *= 0.5;
  if (h.skill === "beginner" && recipe.difficulty === "medium") time *= 0.8;
  if (mins <= Math.min(30, limit)) reasons.push({ text: `Ready in ${a.totalMins} mins`, weight: 0.4 });
  if (recipe.equipment.includes("slow-cooker")) reasons.push({ text: "Mostly hands-off in the slow cooker", weight: 0.5 });

  /* variety */
  let variety = 1;
  const others = state.meals.filter((m) => m.kind === "cook");
  if (others.some((m) => m.recipeId === recipe.id)) variety = 0;
  const near = others.filter((m) => Math.abs(daysBetween(m.date, date)) <= 1);
  for (const m of near) {
    const r = state.recipesById[m.recipeId];
    if (!r) continue;
    const ra = analyseRecipe(r);
    if (ra.proteins.some((p) => a.proteins.includes(p))) variety -= 0.4;
    if (r.cuisine === recipe.cuisine && r.cuisine !== "other") variety -= 0.25;
  }
  for (const p of a.proteins) {
    const count = others.filter((m) => {
      const r = state.recipesById[m.recipeId];
      return r && analyseRecipe(r).proteins.includes(p);
    }).length;
    if (count >= 2) variety -= 0.25 * (count - 1);
  }
  const cuisineCount = others.filter((m) => state.recipesById[m.recipeId]?.cuisine === recipe.cuisine).length;
  if (cuisineCount >= 2) variety -= 0.15 * (cuisineCount - 1);
  variety = clamp01(variety);

  /* health */
  const vegCount = recipe.ingredients.filter((i) => {
    const ing = getIngredient(i.ingredientId);
    return ing && (ing.category === "Fruit & veg" || ing.id === "frozen-peas" || ing.id === "frozen-spinach") && !i.optional;
  }).length;
  let health = 0.35 + Math.min(vegCount, 5) * 0.08;
  if (recipe.tags.includes("healthy")) health += 0.25;
  if (recipe.tags.includes("comfort")) health -= 0.1;
  health = clamp01(health);
  if (h.priorities.health >= 2 && recipe.tags.includes("healthy")) reasons.push({ text: `Veg-packed (${vegCount} kinds of fruit & veg)`, weight: 0.5 });

  /* price confidence */
  const priced = a.ingredientIds.filter((id) => ctx.priceBook.unitPrice(h.supermarket, id)).length;
  const priceConfidence = a.ingredientIds.length ? priced / (a.ingredientIds.length + a.unverified.length) : 0;

  const breakdown: Record<Criterion, number> = { preference, cost, inventory, overlap, waste, time, variety, health, priceConfidence };
  const w = effectiveWeights(h);
  let num = 0;
  let den = 0;
  for (const k of Object.keys(breakdown) as Criterion[]) {
    num += w[k] * breakdown[k];
    den += w[k];
  }
  const score = den ? num / den : 0;

  for (const s of suit.warnings) reasons.push({ text: s, weight: 0.3 });

  return {
    recipe,
    score,
    breakdown,
    reasons: reasons.sort((x, y) => y.weight - x.weight).map((r) => r.text).slice(0, 4),
    marginalCostPence: marginal,
    consumptionPence,
    portions: servings,
  };
}

function shortName(n: string) {
  return n.toLowerCase().replace(/^(classic|easy|big-batch|weeknight|proper)\s+/, "");
}

function listNames(names: string[]): string {
  const u = [...new Set(names)];
  if (u.length <= 1) return u[0] ?? "";
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  return `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}

/** Ranks all eligible recipes for a slot given the rest of the plan. */
export function rankCandidates(
  ctx: PlannerContext,
  meals: PlannedMeal[],
  date: string,
  slot: MealSlot,
  opts: { exclude?: string[]; servings?: number } = {},
): ScoredCandidate[] {
  const recipesById = Object.fromEntries(ctx.recipes.map((r) => [r.id, r]));
  const state = makeState(ctx, meals, recipesById);
  const exclude = new Set(opts.exclude ?? []);
  return eligibleRecipes(ctx, slot)
    .filter((r) => !exclude.has(r.id))
    .map((r) => scoreCandidate(ctx, state, r, date, slot, opts.servings))
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Plan generation                                                     */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  /** Dates to (re)generate. Defaults to every planned day in the week. */
  dates?: string[];
}

export interface GenerateResult {
  plan: MealPlan;
  notes: string[];
}

/**
 * Generates meals for the chosen dates. Locked meals (and leftovers of locked
 * meals) are kept; meals on other dates are never touched.
 */
export function generatePlan(ctx: PlannerContext, plan: MealPlan, opts: GenerateOptions = {}): GenerateResult {
  const h = ctx.household;
  const rng = mulberry32(ctx.seed ?? 1);
  const allDates = h.planDays.map((d) => addDays(plan.weekStart, d)).sort();
  // By default never plan days that have already passed; explicit date choices are honoured.
  const dates = (opts.dates ?? allDates.filter((d) => d >= ctx.today)).slice().sort();
  const dateSet = new Set(dates);
  const notes: string[] = [];
  const recipesById = Object.fromEntries(ctx.recipes.map((r) => [r.id, r]));

  // Keep: meals outside the regenerated dates, locked meals, and leftovers whose source is kept.
  const keptIds = new Set<string>();
  for (const m of plan.meals) {
    if (!dateSet.has(m.date) || m.locked || m.cooked) keptIds.add(m.id);
  }
  for (const m of plan.meals) {
    if (m.kind === "leftover" && m.leftoverOf && keptIds.has(m.leftoverOf) && dateSet.has(m.date) && !m.locked) {
      // a leftover from a kept meal stays only if its source is outside the regenerated range or locked
      const src = plan.meals.find((x) => x.id === m.leftoverOf);
      if (src && (src.locked || !dateSet.has(src.date) || src.cooked)) keptIds.add(m.id);
    }
  }
  let meals = plan.meals.filter((m) => keptIds.has(m.id));
  // Sources that lost their leftovers go back to normal servings.
  meals = meals.map((m) => {
    if (m.kind !== "cook") return m;
    const feeds = meals.filter((x) => x.leftoverOf === m.id).length;
    const expected = h.portionsPerMeal * (1 + feeds);
    return m.servings > expected && !m.locked ? { ...m, servings: expected } : m;
  });

  const newIds = new Set<string>();
  const slotOrder: MealSlot[] = ["dinner", "lunch", "breakfast"];
  for (const slot of slotOrder) {
    if (!h.slots.includes(slot)) continue;
    for (const date of dates) {
      if (!allDates.includes(date) && !opts.dates) continue;
      if (meals.some((m) => m.date === date && m.slot === slot)) continue;
      const ranked = rankCandidates(ctx, meals, date, slot);
      if (!ranked.length) {
        notes.push(`No suitable ${slot} recipes for ${formatDayShort(date)} – try relaxing a preference or adding recipes.`);
        continue;
      }
      // Prefer unrepeated recipes; jitter between near-equal options so "regenerate" gives variety.
      const fresh = ranked.filter((c) => c.breakdown.variety > 0);
      const pool = (fresh.length ? fresh : ranked).slice(0, 6);
      const top = pool[0].score;
      const near = pool.filter((c) => c.score >= top - 0.06);
      const pick = near.reduce((best, c) => {
        const j = c.score + rng() * 0.05;
        return j > best.j ? { c, j } : best;
      }, { c: near[0], j: -1 }).c;
      const meal: PlannedMeal = {
        id: newId("meal"),
        date,
        slot,
        recipeId: pick.recipe.id,
        servings: h.portionsPerMeal,
        locked: false,
        cooked: false,
        kind: "cook",
        reasons: pick.reasons,
        score: Math.round(pick.score * 100),
      };
      meals.push(meal);
      newIds.add(meal.id);
    }
  }

  meals = planLeftovers(ctx, meals, newIds, recipesById, notes);

  return {
    plan: { ...plan, meals: sortMeals(meals), updatedAt: new Date().toISOString() },
    notes,
  };
}

export function sortMeals(meals: PlannedMeal[]): PlannedMeal[] {
  const order: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 };
  return [...meals].sort((a, b) => a.date.localeCompare(b.date) || order[a.slot] - order[b.slot]);
}

/**
 * Turns some newly planned meals into planned leftovers from an earlier
 * batch-cooked meal (cooking extra portions), within the recipe's safe
 * keeping time. Chooses the swaps that save the most money and effort.
 */
function planLeftovers(
  ctx: PlannerContext,
  meals: PlannedMeal[],
  newIds: Set<string>,
  recipesById: Record<string, Recipe>,
  notes: string[],
): PlannedMeal[] {
  const h = ctx.household;
  const existing = meals.filter((m) => m.kind === "leftover").length;
  let budget = h.batchCooking ? h.leftoversPerWeek - existing : 0;
  if (budget <= 0) return meals;
  const result = meals.map((m) => ({ ...m }));
  const used = new Set<string>();

  while (budget > 0) {
    let best: { src: PlannedMeal; target: PlannedMeal; value: number } | null = null;
    for (const src of result) {
      if (src.kind !== "cook" || used.has(src.id) || src.cooked) continue;
      const r = recipesById[src.recipeId];
      if (!r || r.keepsDays < 1 || src.slot === "breakfast") continue;
      if (result.some((m) => m.leftoverOf === src.id)) continue;
      for (const target of result) {
        if (!newIds.has(target.id) || target.id === src.id || target.kind !== "cook" || used.has(target.id)) continue;
        if (result.some((m) => m.leftoverOf === target.id)) continue;
        if (target.slot === "breakfast") continue;
        const gap = daysBetween(src.date, target.date);
        if (gap < 1 || gap > r.keepsDays) continue;
        const tr = recipesById[target.recipeId];
        const busy = !isWeekend(target.date) ? 1 : 0;
        const value =
          busy * 1.2 +
          (tr ? analyseRecipe(tr).activeMins / 30 : 0) +
          (gap === 2 ? 0.4 : gap === 1 ? 0.3 : 0) +
          (target.slot === "lunch" ? 0.3 : 0) +
          (r.tags.includes("batch-cook") ? 0.5 : 0);
        if (!best || value > best.value) best = { src, target, value };
      }
    }
    if (!best) break;
    const { src, target } = best;
    const srcRecipe = recipesById[src.recipeId];
    src.servings += target.servings;
    src.reasons = [`Cook a double batch – leftovers for ${formatDayShort(target.date)} ${target.slot}`, ...(src.reasons ?? [])].slice(0, 4);
    Object.assign(target, {
      kind: "leftover" as const,
      recipeId: src.recipeId,
      leftoverOf: src.id,
      reasons: [
        `Leftovers from ${formatDayShort(src.date)}'s ${shortName(srcRecipe.name)} – no cooking`,
        `Keeps ${srcRecipe.keepsDays} day${srcRecipe.keepsDays === 1 ? "" : "s"} in the fridge`,
      ],
      score: undefined,
    });
    used.add(src.id);
    used.add(target.id);
    budget--;
    notes.push(`Planned leftovers: ${srcRecipe.name} on ${formatDayShort(src.date)} also covers ${formatDayShort(target.date)}.`);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Editing helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Replaces one meal with a new recipe, preserving every other meal.
 * - Replacing a leftover makes it a normal cooked meal and shrinks the source batch.
 * - Replacing a batch-cooked source moves its leftovers onto the new recipe when
 *   it keeps long enough; otherwise those leftover slots are cleared (and reported).
 */
export function replaceMeal(
  plan: MealPlan,
  mealId: string,
  newRecipe: Recipe,
  household: Household,
): { plan: MealPlan; notes: string[] } {
  const notes: string[] = [];
  const target = plan.meals.find((m) => m.id === mealId);
  if (!target) return { plan, notes };
  let meals = plan.meals.map((m) => ({ ...m }));
  const t = meals.find((m) => m.id === mealId)!;

  if (t.kind === "leftover" && t.leftoverOf) {
    const src = meals.find((m) => m.id === t.leftoverOf);
    if (src) src.servings = Math.max(household.portionsPerMeal, src.servings - t.servings);
    t.kind = "cook";
    delete t.leftoverOf;
  }
  t.recipeId = newRecipe.id;
  t.reasons = ["Chosen by you"];
  t.score = undefined;
  t.cooked = false;
  delete (t as PlannedMeal & { substitutions?: unknown }).substitutions;

  const dependents = meals.filter((m) => m.leftoverOf === t.id);
  const keepIds = new Set<string>();
  for (const d of dependents) {
    const gap = daysBetween(t.date, d.date);
    if (newRecipe.keepsDays >= gap && gap >= 1) {
      d.recipeId = newRecipe.id;
      keepIds.add(d.id);
    } else {
      notes.push(`${newRecipe.name} doesn't keep until ${formatDayShort(d.date)}, so that leftover night has been cleared.`);
      t.servings = Math.max(household.portionsPerMeal, t.servings - d.servings);
    }
  }
  meals = meals.filter((m) => m.leftoverOf !== t.id || keepIds.has(m.id));
  return { plan: { ...plan, meals: sortMeals(meals), updatedAt: new Date().toISOString() }, notes };
}

/** Removes a meal; leftovers depending on it are removed too, a leftover's source shrinks. */
export function removeMeal(plan: MealPlan, mealId: string, household: Household): MealPlan {
  const target = plan.meals.find((m) => m.id === mealId);
  if (!target) return plan;
  let meals = plan.meals.filter((m) => m.id !== mealId && m.leftoverOf !== mealId);
  if (target.kind === "leftover" && target.leftoverOf) {
    meals = meals.map((m) =>
      m.id === target.leftoverOf ? { ...m, servings: Math.max(household.portionsPerMeal, m.servings - target.servings) } : m,
    );
  }
  return { ...plan, meals, updatedAt: new Date().toISOString() };
}

/**
 * Moves a meal to another day/slot. If occupied, the two meals swap places.
 * Returns a warning when a leftover would end up before (or too long after) its cooking day.
 */
export function moveMeal(
  plan: MealPlan,
  mealId: string,
  toDate: string,
  toSlot: MealSlot,
  recipes: Record<string, Recipe>,
): { plan: MealPlan; warning?: string } {
  const meals = plan.meals.map((m) => ({ ...m }));
  const m = meals.find((x) => x.id === mealId);
  if (!m) return { plan };
  const occupant = meals.find((x) => x.date === toDate && x.slot === toSlot && x.id !== mealId);
  const fromDate = m.date;
  const fromSlot = m.slot;
  m.date = toDate;
  m.slot = toSlot;
  if (occupant) {
    occupant.date = fromDate;
    occupant.slot = fromSlot;
  }
  let warning: string | undefined;
  for (const x of meals) {
    if (x.kind !== "leftover" || !x.leftoverOf) continue;
    const src = meals.find((s) => s.id === x.leftoverOf);
    const r = src && recipes[src.recipeId];
    if (!src || !r) continue;
    const gap = daysBetween(src.date, x.date);
    if (gap < 0 || (gap === 0 && slotRank(x.slot) <= slotRank(src.slot))) warning = `Leftovers on ${formatDayShort(x.date)} are now before ${r.name} is cooked.`;
    else if (gap > r.keepsDays) warning = `${r.name} only keeps ${r.keepsDays} day(s) – consider freezing the leftovers or moving them earlier.`;
  }
  return { plan: { ...plan, meals: sortMeals(meals), updatedAt: new Date().toISOString() }, warning };
}

function slotRank(s: MealSlot) {
  return s === "breakfast" ? 0 : s === "lunch" ? 1 : 2;
}

/** Changes portions, keeping planned leftovers' share intact. */
export function setServings(plan: MealPlan, mealId: string, servings: number): MealPlan {
  return {
    ...plan,
    meals: plan.meals.map((m) => (m.id === mealId ? { ...m, servings: Math.max(0.5, Math.min(48, servings)) } : m)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Plans leftovers manually: cook extra of `sourceId` for `targetDate`/`slot`.
 * Any meal already in that slot is replaced (only that meal).
 */
export function addLeftover(
  plan: MealPlan,
  sourceId: string,
  targetDate: string,
  slot: MealSlot,
  household: Household,
  recipes: Record<string, Recipe>,
): { plan: MealPlan; error?: string } {
  const src = plan.meals.find((m) => m.id === sourceId);
  if (!src || src.kind !== "cook") return { plan, error: "Only cooked meals can make leftovers." };
  const r = recipes[src.recipeId];
  const gap = daysBetween(src.date, targetDate);
  if (!r) return { plan, error: "Recipe not found." };
  if (gap < 0 || (gap === 0 && slotRank(slot) <= slotRank(src.slot))) return { plan, error: "Leftovers must come after the meal is cooked." };
  if (gap > r.keepsDays) return { plan, error: r.keepsDays ? `${r.name} keeps ${r.keepsDays} day(s) in the fridge.` : `${r.name} isn't suited to keeping as leftovers.` };
  let next = plan;
  const occupant = plan.meals.find((m) => m.date === targetDate && m.slot === slot);
  if (occupant) next = removeMeal(next, occupant.id, household);
  const leftover: PlannedMeal = {
    id: newId("meal"),
    date: targetDate,
    slot,
    recipeId: src.recipeId,
    servings: household.portionsPerMeal,
    locked: false,
    cooked: false,
    kind: "leftover",
    leftoverOf: src.id,
    reasons: [`Leftovers from ${formatDayShort(src.date)}'s ${shortName(r.name)}`],
  };
  const meals = next.meals.map((m) => (m.id === src.id ? { ...m, servings: m.servings + household.portionsPerMeal } : m));
  return { plan: { ...next, meals: sortMeals([...meals, leftover]), updatedAt: new Date().toISOString() } };
}

/** Copies a previous week's meals into another week (unlocked, uncooked). */
export function copyPlanToWeek(source: MealPlan, weekStart: string): MealPlan {
  const offset = daysBetween(source.weekStart, weekStart);
  const idMap = new Map<string, string>();
  for (const m of source.meals) idMap.set(m.id, newId("meal"));
  const now = new Date().toISOString();
  return {
    id: newId("plan"),
    weekStart,
    createdAt: now,
    updatedAt: now,
    meals: source.meals.map((m) => ({
      ...m,
      id: idMap.get(m.id)!,
      date: addDays(m.date, offset),
      cooked: false,
      locked: false,
      leftoverOf: m.leftoverOf ? idMap.get(m.leftoverOf) : undefined,
      reasons: ["Reused from a previous week"],
      score: undefined,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Budget fitting                                                      */
/* ------------------------------------------------------------------ */

export interface BudgetSwap {
  mealId: string;
  date: string;
  from: string;
  to: string;
  savingPence: number;
}

/**
 * Greedy, transparent budget optimisation: repeatedly makes the single swap of an
 * unlocked, uncooked meal that saves the most on the *shopping bill* (accounting
 * for shared packs and food at home), until the plan fits the budget or no
 * saving swap remains. Each swap is reported.
 */
export function fitToBudget(
  ctx: PlannerContext,
  plan: MealPlan,
  budgetPence: number,
  maxSwaps = 8,
): { plan: MealPlan; swaps: BudgetSwap[]; before: number; after: number } {
  const recipesById = Object.fromEntries(ctx.recipes.map((r) => [r.id, r]));
  let current = plan;
  const swaps: BudgetSwap[] = [];
  const before = summarise(ctx, current.meals, recipesById).cost;
  let cost = before;

  for (let i = 0; i < maxSwaps && cost > budgetPence; i++) {
    let best: { meal: PlannedMeal; recipe: Recipe; newCost: number } | null = null;
    for (const meal of current.meals) {
      if (meal.locked || meal.cooked || meal.kind !== "cook") continue;
      const others = current.meals.filter((m) => m.id !== meal.id);
      const inPlan = new Set(current.meals.map((m) => m.recipeId));
      for (const r of eligibleRecipes(ctx, meal.slot)) {
        if (inPlan.has(r.id)) continue;
        const dependents = current.meals.filter((m) => m.leftoverOf === meal.id);
        if (dependents.some((d) => daysBetween(meal.date, d.date) > r.keepsDays)) continue;
        const candidate = { ...meal, recipeId: r.id, substitutions: undefined } as PlannedMeal;
        const deps = dependents.map((d) => ({ ...d, recipeId: r.id }));
        const rest = others.filter((m) => !dependents.some((d) => d.id === m.id));
        const newCost = summarise(ctx, [...rest, candidate, ...deps], recipesById).cost;
        if (newCost < cost - 10 && (!best || newCost < best.newCost)) best = { meal, recipe: r, newCost };
      }
    }
    if (!best) break;
    const fromName = recipesById[best.meal.recipeId]?.name ?? "meal";
    const res = replaceMeal(current, best.meal.id, best.recipe, ctx.household);
    current = {
      ...res.plan,
      meals: res.plan.meals.map((m) => (m.id === best!.meal.id ? { ...m, reasons: [`Swapped in to save about ${formatPence(cost - best!.newCost)}`] } : m)),
    };
    swaps.push({ mealId: best.meal.id, date: best.meal.date, from: fromName, to: best.recipe.name, savingPence: cost - best.newCost });
    cost = best.newCost;
  }
  return { plan: current, swaps, before, after: cost };
}

/* ------------------------------------------------------------------ */
/* Use what I have                                                     */
/* ------------------------------------------------------------------ */

export interface PantrySuggestion {
  recipe: Recipe;
  matched: string[];
  expiring: string[];
  missingCount: number;
  missing: string[];
  score: number;
}

/** Ranks recipes by how much of their (non-staple) ingredients are already at home, prioritising items near their date. */
export function suggestFromInventory(ctx: PlannerContext, limit = 12): PantrySuggestion[] {
  const idx = inventoryIndex(ctx.inventory);
  if (!idx.size) return [];
  const out: PantrySuggestion[] = [];
  for (const r of eligibleRecipes(ctx)) {
    const a = analyseRecipe(r);
    const matched: string[] = [];
    const expiring: string[] = [];
    const missing: string[] = [];
    for (const line of r.ingredients) {
      const ing = getIngredient(line.ingredientId);
      if (!ing || ing.staple || line.optional) continue;
      const items = idx.get(ing.id);
      if (items) {
        matched.push(ing.name);
        for (const it of items) {
          if (it.date && daysBetween(ctx.today, it.date) <= 3 && (it.dateType !== "use-by" || daysBetween(ctx.today, it.date) >= 0)) {
            expiring.push(it.name);
          }
        }
      } else missing.push(ing.name);
    }
    if (!matched.length) continue;
    const uniqueMatched = [...new Set(matched)];
    const total = uniqueMatched.length + new Set(missing).size;
    const score = uniqueMatched.length / total + new Set(expiring).size * 0.35 - (a.totalMins > 60 ? 0.1 : 0);
    out.push({ recipe: r, matched: uniqueMatched, expiring: [...new Set(expiring)], missingCount: new Set(missing).size, missing: [...new Set(missing)], score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Days until a date (negative if past). */
export function daysUntil(today: string, date: string) {
  return Math.round((parseISO(date).getTime() - parseISO(today).getTime()) / 86_400_000);
}
