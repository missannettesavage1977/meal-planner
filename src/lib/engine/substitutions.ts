import { getIngredient } from "../data/ingredients";
import type { Recipe } from "../domain/types";
import { toBase } from "./units";

/**
 * A chosen substitution on a planned meal: original ingredient id → index of the
 * alternative in the recipe's substitution list.
 */
export type MealSubstitutions = Record<string, number>;

/**
 * Returns a copy of the recipe with substitutions applied.
 * Quantities are converted through the original ingredient's base unit and the
 * alternative's ratio (base units of the alternative per base unit of the original).
 * Free-text alternatives keep the original quantity and unit.
 */
export function applySubstitutions(recipe: Recipe, subs: MealSubstitutions | undefined): Recipe {
  if (!subs || !Object.keys(subs).length) return recipe;
  const ingredients = recipe.ingredients.map((line) => {
    if (!line.ingredientId || subs[line.ingredientId] === undefined) return line;
    const def = recipe.substitutions.find((s) => s.ingredientId === line.ingredientId);
    const alt = def?.alternatives[subs[line.ingredientId]];
    if (!alt) return line;
    if (!alt.ingredientId) {
      return { ...line, ingredientId: null, name: alt.name, note: alt.note ?? line.note };
    }
    const from = getIngredient(line.ingredientId);
    const to = getIngredient(alt.ingredientId);
    if (!from || !to) return line;
    const base = toBase(from, line.quantity, line.unit);
    if (base === null) return { ...line, ingredientId: to.id, name: to.name, note: alt.note ?? line.note };
    return {
      ingredientId: to.id,
      name: to.name,
      quantity: Math.round(base * alt.ratio * 100) / 100,
      unit: to.baseUnit,
      note: alt.note ?? line.note,
      optional: line.optional,
    };
  });
  return { ...recipe, ingredients, id: recipe.id };
}
