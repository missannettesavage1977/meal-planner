import { describe, expect, it } from "vitest";
import { SEED_RECIPES } from "@/lib/data/recipes";
import { analyseRecipe, checkSuitability } from "@/lib/engine/recipeMeta";
import {
  addLeftover,
  eligibleRecipes,
  fitToBudget,
  generatePlan,
  moveMeal,
  removeMeal,
  replaceMeal,
  suggestFromInventory,
  type PlannerContext,
} from "@/lib/engine/planner";
import { PriceBook } from "@/lib/pricing/priceBook";
import { computeBudget } from "@/lib/engine/budget";
import type { MealPlan } from "@/lib/domain/types";
import { household, inv } from "./helpers";

const book = PriceBook.withDemo();
const byId = Object.fromEntries(SEED_RECIPES.map((r) => [r.id, r]));
const WEEK = "2026-10-12"; // a Monday
const empty = (): MealPlan => ({ id: "p", weekStart: WEEK, meals: [], createdAt: "", updatedAt: "" });

function ctx(patch: Parameters<typeof household>[0] = {}, extra: Partial<PlannerContext> = {}): PlannerContext {
  return { household: household(patch), recipes: SEED_RECIPES, inventory: [], priceBook: book, today: "2026-10-11", seed: 7, ...extra };
}

describe("allergy and diet exclusion", () => {
  it("never plans a recipe containing a declared allergen", () => {
    for (const allergen of ["peanuts", "fish", "milk", "gluten", "crustaceans"] as const) {
      const c = ctx({ allergens: [allergen], slots: ["dinner", "lunch"] });
      const { plan } = generatePlan(c, empty());
      expect(plan.meals.length).toBeGreaterThan(0);
      for (const m of plan.meals) {
        const a = analyseRecipe(byId[m.recipeId]);
        expect(a.allergens).not.toContain(allergen);
        expect(a.mayContain).not.toContain(allergen);
      }
    }
  });

  it("treats Worcestershire sauce (anchovies) as fish and curry paste 'may contain' as excluded", () => {
    const h = household({ allergens: ["fish"] });
    expect(checkSuitability(byId["shepherds-pie"], h).ok).toBe(false);
    expect(checkSuitability(byId["thai-green-chicken-curry"], h).ok).toBe(false);
    expect(checkSuitability(byId["red-lentil-dhal"], h).ok).toBe(true);
  });

  it("excludes recipes with ingredients matching a free-text allergy", () => {
    const h = household({ allergyTerms: ["coconut"] });
    expect(checkSuitability(byId["chickpea-spinach-curry"], h).ok).toBe(false);
  });

  it("filters by diet, including hidden animal products", () => {
    const veg = eligibleRecipes(ctx({ diets: ["vegetarian"] }), "dinner");
    expect(veg.length).toBeGreaterThan(5);
    expect(veg.map((r) => r.id)).not.toContain("spaghetti-bolognese");
    expect(veg.map((r) => r.id)).not.toContain("pesto-pasta-peas"); // pesto/parmesan use animal rennet
    const vegan = eligibleRecipes(ctx({ diets: ["vegan"] }), "dinner");
    for (const r of vegan) expect(analyseRecipe(r).dietLevel).toBe("vegan");
  });

  it("excludes disliked ingredients and recipes needing missing equipment", () => {
    const c = ctx({ dislikes: ["mushroom"], equipment: ["hob"] });
    const ids = eligibleRecipes(c, "dinner").map((r) => r.id);
    expect(ids).not.toContain("mushroom-risotto");
    expect(ids).not.toContain("slow-cooker-beef-stew");
    expect(ids).not.toContain("salmon-traybake"); // needs oven
  });

  it("refuses to auto-plan unverifiable user recipes when allergies are set", () => {
    const custom = { ...byId["red-lentil-dhal"], id: "custom", ingredients: [...byId["red-lentil-dhal"].ingredients, { ingredientId: null, name: "mystery sauce", quantity: 1, unit: "tbsp" }] };
    expect(checkSuitability(custom, household({ allergens: ["sesame"] })).ok).toBe(false);
    expect(checkSuitability(custom, household()).ok).toBe(true);
  });
});

describe("plan generation", () => {
  it("fills every planned day with suitable, non-repeating meals", () => {
    const { plan } = generatePlan(ctx({ leftoversPerWeek: 0 }), empty());
    expect(plan.meals).toHaveLength(7);
    const ids = plan.meals.map((m) => m.recipeId);
    expect(new Set(ids).size).toBe(7);
    expect(plan.meals.every((m) => m.reasons && m.reasons.length > 0)).toBe(true);
  });

  it("generates selected days only, leaving other days untouched", () => {
    const first = generatePlan(ctx({ leftoversPerWeek: 0 }), empty()).plan;
    const tue = "2026-10-13";
    const wed = "2026-10-14";
    const res = generatePlan({ ...ctx({ leftoversPerWeek: 0 }), seed: 99 }, first, { dates: [tue, wed] });
    for (const m of first.meals.filter((m) => m.date !== tue && m.date !== wed)) {
      expect(res.plan.meals.find((x) => x.id === m.id)).toEqual(m);
    }
    expect(res.plan.meals.filter((m) => m.date === tue || m.date === wed)).toHaveLength(2);
  });

  it("keeps locked meals when regenerating the week", () => {
    const first = generatePlan(ctx({ leftoversPerWeek: 0 }), empty()).plan;
    const locked = { ...first.meals[2], locked: true };
    const withLock = { ...first, meals: first.meals.map((m) => (m.id === locked.id ? locked : m)) };
    const res = generatePlan({ ...ctx({ leftoversPerWeek: 0 }), seed: 1234 }, withLock).plan;
    expect(res.meals.find((m) => m.id === locked.id)).toEqual(locked);
    expect(res.meals).toHaveLength(7);
  });

  it("plans leftovers within the recipe's safe keeping time", () => {
    const { plan } = generatePlan(ctx({ batchCooking: true, leftoversPerWeek: 2 }), empty());
    const leftovers = plan.meals.filter((m) => m.kind === "leftover");
    expect(leftovers.length).toBeGreaterThan(0);
    for (const l of leftovers) {
      const src = plan.meals.find((m) => m.id === l.leftoverOf)!;
      expect(src).toBeDefined();
      expect(src.recipeId).toBe(l.recipeId);
      const gap = (Date.parse(l.date) - Date.parse(src.date)) / 86400000;
      expect(gap).toBeGreaterThanOrEqual(1);
      expect(gap).toBeLessThanOrEqual(byId[src.recipeId].keepsDays);
      expect(src.servings).toBeGreaterThan(household().portionsPerMeal);
    }
  });

  it("prioritises ingredients at home that are close to their use-by date", () => {
    const c = ctx({ leftoversPerWeek: 0 }, { inventory: [inv("spinach", 240, "g", { location: "fridge", date: "2026-10-13", dateType: "use-by" })] });
    const { plan } = generatePlan(c, empty());
    const early = plan.meals.filter((m) => m.date <= "2026-10-13").map((m) => byId[m.recipeId]);
    expect(early.some((r) => analyseRecipe(r).ingredientIds.includes("spinach"))).toBe(true);
  });

  it("suggests recipes from what's at home", () => {
    const c = ctx({}, { inventory: [inv("red lentils", 500, "g"), inv("onions", 3, "item"), inv("spinach", 200, "g", { date: "2026-10-12", dateType: "use-by" })] });
    const s = suggestFromInventory(c);
    expect(s[0].matched.length).toBeGreaterThanOrEqual(2);
    expect(s.some((x) => x.recipe.id === "red-lentil-dhal")).toBe(true);
  });
});

describe("meal editing preserves the rest of the plan", () => {
  const base = generatePlan(ctx({ leftoversPerWeek: 0 }), empty()).plan;
  const h = household();

  it("swaps one meal without changing or deleting other meals", () => {
    const target = base.meals[3];
    const newRecipe = SEED_RECIPES.find((r) => !base.meals.some((m) => m.recipeId === r.id) && r.mealTypes.includes("dinner"))!;
    const { plan } = replaceMeal(base, target.id, newRecipe, h);
    expect(plan.meals).toHaveLength(base.meals.length);
    expect(plan.meals.find((m) => m.id === target.id)!.recipeId).toBe(newRecipe.id);
    for (const m of base.meals.filter((x) => x.id !== target.id)) expect(plan.meals.find((x) => x.id === m.id)).toEqual(m);
  });

  it("removing a meal removes only that meal (and its own leftovers)", () => {
    const withLeftover = addLeftover(base, base.meals[0].id, "2026-10-13", "lunch", h, byId);
    const src = base.meals[0];
    if (withLeftover.error) {
      // recipe doesn't keep – remove a meal plainly
      const p = removeMeal(base, src.id, h);
      expect(p.meals).toHaveLength(base.meals.length - 1);
      return;
    }
    const p = removeMeal(withLeftover.plan, src.id, h);
    expect(p.meals.some((m) => m.leftoverOf === src.id)).toBe(false);
    expect(p.meals).toHaveLength(base.meals.length - 1);
  });

  it("replacing a batch-cooked meal moves or clears its leftovers explicitly", () => {
    const chilli = byId["chilli-con-carne"]; // keeps 3 days
    const p1 = replaceMeal(base, base.meals[0].id, chilli, h).plan;
    const p2 = addLeftover(p1, base.meals[0].id, "2026-10-14", "dinner", h, byId);
    expect(p2.error).toBeUndefined();
    expect(p2.plan.meals).toHaveLength(base.meals.length); // replaced Wed's meal only
    const quick = byId["chicken-fajitas"]; // keepsDays 0
    const res = replaceMeal(p2.plan, base.meals[0].id, quick, h);
    expect(res.notes.join(" ")).toMatch(/doesn't keep/);
    expect(res.plan.meals.some((m) => m.kind === "leftover")).toBe(false);
    expect(res.plan.meals).toHaveLength(base.meals.length - 1);
  });

  it("moving a meal onto an occupied day swaps the two", () => {
    const [a, b] = [base.meals[0], base.meals[4]];
    const { plan } = moveMeal(base, a.id, b.date, b.slot, byId);
    expect(plan.meals.find((m) => m.id === a.id)!.date).toBe(b.date);
    expect(plan.meals.find((m) => m.id === b.id)!.date).toBe(a.date);
    expect(plan.meals).toHaveLength(base.meals.length);
  });

  it("refuses leftovers beyond the safe keeping time", () => {
    const fajitas = replaceMeal(base, base.meals[0].id, byId["chicken-fajitas"], h).plan;
    const res = addLeftover(fajitas, base.meals[0].id, "2026-10-13", "dinner", h, byId);
    expect(res.error).toBeTruthy();
  });
});

describe("budget fitting", () => {
  it("reduces the shopping bill with reported swaps and never touches locked meals", () => {
    const c = ctx({ leftoversPerWeek: 0, priorities: { health: 2, convenience: 2, variety: 2, savings: 0 }, weeklyBudgetPence: 100000 });
    const plan = generatePlan(c, empty()).plan;
    const locked = { ...plan.meals[0], locked: true };
    const lockedPlan = { ...plan, meals: plan.meals.map((m) => (m.id === locked.id ? locked : m)) };
    const res = fitToBudget(c, lockedPlan, 1000);
    expect(res.after).toBeLessThanOrEqual(res.before);
    expect(res.plan.meals.find((m) => m.id === locked.id)).toEqual(locked);
    if (res.swaps.length) {
      expect(res.after).toBeLessThan(res.before);
      const b = computeBudget({ plan: res.plan, recipes: byId, household: c.household, inventory: [], priceBook: book });
      expect(b.shopping.pence).toBeCloseTo(res.after, 0);
    }
  });
});
