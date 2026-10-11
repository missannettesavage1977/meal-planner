import { getIngredient } from "../data/ingredients";
import type { Allergen, Diet, DietLevel, Household, IngredientDef, Recipe } from "../domain/types";
import { matchIngredient, tokenise } from "./normalise";

/**
 * Derived recipe facts: allergens, diet suitability and tags.
 *
 * Allergen information is *derived from the ingredient list* using typical
 * product composition. Brands differ, and cross-contamination is not modelled,
 * so the UI always shows a caveat asking users to check labels.
 */

export interface RecipeAnalysis {
  allergens: Allergen[];
  mayContain: Allergen[];
  dietLevel: DietLevel;
  diets: Diet[];
  /** Ingredients we could not identify, so allergens/diet cannot be verified. */
  unverified: string[];
  totalMins: number;
  /** Hands-on minutes (slow-cooker recipes are mostly unattended). */
  activeMins: number;
  proteins: string[];
  ingredientIds: string[];
}

const DIET_RANK: Record<DietLevel, number> = { vegan: 0, vegetarian: 1, pescatarian: 2, meat: 3 };

export function resolveIngredient(i: { ingredientId: string | null; name: string }): IngredientDef | undefined {
  return getIngredient(i.ingredientId) ?? matchIngredient(i.name) ?? undefined;
}

const cache = new WeakMap<Recipe, RecipeAnalysis>();

export function analyseRecipe(recipe: Recipe): RecipeAnalysis {
  const hit = cache.get(recipe);
  if (hit) return hit;
  const allergens = new Set<Allergen>();
  const may = new Set<Allergen>();
  const proteins = new Set<string>();
  const ids: string[] = [];
  const unverified: string[] = [];
  let level: DietLevel = "vegan";
  let pork = false;
  let beef = false;

  for (const line of recipe.ingredients) {
    const ing = resolveIngredient(line);
    if (!ing) {
      unverified.push(line.name);
      continue;
    }
    ids.push(ing.id);
    ing.allergens.forEach((a) => allergens.add(a));
    ing.mayContain?.forEach((a) => may.add(a));
    if (DIET_RANK[ing.diet] > DIET_RANK[level]) level = ing.diet;
    if (ing.protein && !line.optional) proteins.add(ing.protein);
    if (ing.tags?.includes("pork")) pork = true;
    if (ing.tags?.includes("beef")) beef = true;
  }
  for (const a of allergens) may.delete(a);

  const diets: Diet[] = [];
  if (unverified.length === 0) {
    if (level === "vegan") diets.push("vegan");
    if (DIET_RANK[level] <= 1) diets.push("vegetarian");
    if (DIET_RANK[level] <= 2) diets.push("pescatarian");
    if (!allergens.has("gluten") && !may.has("gluten")) diets.push("gluten-free");
    if (!allergens.has("milk") && !may.has("milk")) diets.push("dairy-free");
    if (!pork) diets.push("no-pork");
    if (!beef) diets.push("no-beef");
  }

  const slow = recipe.equipment.includes("slow-cooker");
  const result: RecipeAnalysis = {
    allergens: [...allergens],
    mayContain: [...may],
    dietLevel: level,
    diets,
    unverified,
    totalMins: recipe.prepMins + recipe.cookMins,
    activeMins: slow ? recipe.prepMins + 10 : recipe.prepMins + recipe.cookMins,
    proteins: [...proteins],
    ingredientIds: ids,
  };
  cache.set(recipe, result);
  return result;
}

/** Display tags, combining authored tags with ones derived from data. */
export function recipeTags(recipe: Recipe): string[] {
  const a = analyseRecipe(recipe);
  const tags = new Set(recipe.tags);
  if (a.totalMins <= 30) tags.add("quick");
  if (a.diets.includes("vegan")) tags.add("vegan");
  else if (a.diets.includes("vegetarian")) tags.add("vegetarian");
  if (a.diets.includes("gluten-free")) tags.add("gluten-free");
  if (recipe.freezable) tags.add("freezable");
  if (recipe.keepsDays >= 2 || recipe.tags.includes("batch-cook")) tags.add("leftovers");
  return [...tags];
}

/* ------------------------------------------------------------------ */
/* Suitability                                                         */
/* ------------------------------------------------------------------ */

export interface Suitability {
  ok: boolean;
  /** Reasons the recipe is excluded (strict). */
  blockers: string[];
  /** Ingredient-level notes (e.g. optional disliked ingredient). */
  warnings: string[];
}

function termMatches(term: string, haystack: string): boolean {
  const t = tokenise(term).join(" ");
  if (!t) return false;
  const h = ` ${tokenise(haystack).join(" ")} `;
  return h.includes(` ${t} `);
}

function ingredientHaystack(line: { name: string; ingredientId: string | null }): string {
  const ing = resolveIngredient(line);
  return [line.name, ing?.name ?? "", ...(ing?.aliases ?? []), ing?.plural ?? ""].join(" | ");
}

/**
 * Strict suitability check for a household. Allergies (including "may contain"
 * and unidentifiable ingredients) are hard exclusions, never preferences.
 */
export function checkSuitability(recipe: Recipe, h: Pick<Household, "allergens" | "allergyTerms" | "diets" | "dislikes" | "equipment">): Suitability {
  const a = analyseRecipe(recipe);
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const al of h.allergens) {
    if (a.allergens.includes(al)) blockers.push(`Contains ${al.replace("-", " ")}`);
    else if (a.mayContain.includes(al)) blockers.push(`May contain ${al.replace("-", " ")} (varies by brand)`);
  }
  for (const term of h.allergyTerms) {
    const hit = recipe.ingredients.find((i) => termMatches(term, ingredientHaystack(i)));
    if (hit) blockers.push(`Contains ${hit.name} (allergy: ${term})`);
  }
  for (const d of h.diets) {
    if (!a.diets.includes(d)) blockers.push(a.unverified.length ? `Can't confirm it's ${d}` : `Not ${d}`);
  }
  if ((h.allergens.length || h.allergyTerms.length) && a.unverified.length) {
    blockers.push(`Can't check allergens for: ${a.unverified.join(", ")}`);
  }
  for (const term of h.dislikes) {
    const hit = recipe.ingredients.find((i) => termMatches(term, ingredientHaystack(i)));
    if (hit) {
      if (hit.optional) warnings.push(`Leave out the ${hit.name} (you don't like ${term})`);
      else blockers.push(`Contains ${hit.name}, which you don't like`);
    }
  }
  const missingEq = recipe.equipment.filter((e) => !h.equipment.includes(e));
  if (missingEq.length) blockers.push(`Needs ${missingEq.join(", ")}`);

  return { ok: blockers.length === 0, blockers, warnings };
}
