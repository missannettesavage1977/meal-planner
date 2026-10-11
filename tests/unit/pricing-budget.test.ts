import { describe, expect, it } from "vitest";
import { computeBudget, mealConsumptionCost } from "@/lib/engine/budget";
import { consolidate, recipeRequirements, sumLines } from "@/lib/engine/consolidate";
import { PriceBook } from "@/lib/pricing/priceBook";
import { demoProducts } from "@/lib/pricing/demoProvider";
import type { MealPlan, PlannedMeal } from "@/lib/domain/types";
import { household, inv, product, recipe } from "./helpers";

const book = new PriceBook([
  product("plain-flour", 1500, 90),
  product("rice", 1000, 200),
  product("onion", 1, 20),
  product("chicken-breast", 300, 300),
  product("spinach", 240, 120),
]);

const meal = (id: string, recipeId: string, servings: number, extra: Partial<PlannedMeal> = {}): PlannedMeal => ({
  id,
  date: "2026-10-12",
  slot: "dinner",
  recipeId,
  servings,
  locked: false,
  cooked: false,
  kind: "cook",
  ...extra,
});

describe("consumption cost vs purchase cost", () => {
  it("charges a recipe for the flour it uses, but the shopper for the whole bag", () => {
    const r = recipe("r", [["plain-flour", 100, "g"]], 4);
    const lines = consolidate(recipeRequirements(r, 4), { priceBook: book, supermarket: "tesco" });
    expect(lines[0].consumptionCost.pence).toBeCloseTo(6); // 100/1500 × 90p
    expect(lines[0].purchaseCost.pence).toBe(90); // must buy the 1.5 kg bag
  });
});

describe("cost per portion", () => {
  it("divides meal consumption cost by servings and scales with portions", () => {
    const r = recipe("r", [["chicken-breast", 300, "g"], ["rice", 200, "g"]], 2);
    const two = mealConsumptionCost(r, 2, household(), book);
    expect(two.pence).toBeCloseTo(300 + 40);
    expect(two.pence / 2).toBeCloseTo(170);
    const four = mealConsumptionCost(r, 4, household(), book);
    expect(four.pence / 4).toBeCloseTo(170); // per-portion cost is stable when scaling
  });
});

describe("budget calculations", () => {
  const curry = recipe("curry", [["spinach", 120, "g"], ["onion", 1, "item"], ["rice", 300, "g"]], 2);
  const pasta = recipe("pasta", [["spinach", 120, "g"], ["onion", 1, "item"]], 2);
  const recipes = { curry, pasta };
  const plan: Pick<MealPlan, "meals"> = { meals: [meal("m1", "curry", 2), meal("m2", "pasta", 2, { date: "2026-10-13" })] };

  it("reports shopping, remaining budget, and separates overlap from inventory savings", () => {
    const h = household({ weeklyBudgetPence: 1000, assumeStaples: false });
    const withoutInventory = computeBudget({ plan, recipes, household: h, inventory: [], priceBook: book });
    // Bought separately: spinach 120 + onion 20 + rice 200 = 340 and spinach 120 + onion 20 = 140 → A = 480
    // Together: one 240 g spinach bag (120) + 2 onions (40) + rice (200) = 360 → overlap saving 120
    expect(withoutInventory.shopping.pence).toBe(360);
    expect(withoutInventory.overlapSavingPence).toBe(120);
    expect(withoutInventory.inventorySavingPence).toBe(0);
    expect(withoutInventory.remainingPence).toBe(640);

    const withRice = computeBudget({ plan, recipes, household: h, inventory: [inv("rice", 1000, "g")], priceBook: book });
    expect(withRice.shopping.pence).toBe(160);
    expect(withRice.overlapSavingPence).toBe(120); // unchanged – not double-counted
    expect(withRice.inventorySavingPence).toBe(200);
    expect(withRice.inventoryUsed.pence).toBeCloseTo(60); // 300 g of rice @ 0.2p/g consumed from home
    expect(withRice.remainingPence).toBe(840);
  });

  it("includes priced ad hoc items only when the budget covers all groceries", () => {
    const adhoc = [{ id: "a", name: "Washing-up liquid", quantity: "1", category: "Other" as const, pricePence: 150, checked: false }];
    const meals = computeBudget({ plan, recipes, household: household({ weeklyBudgetPence: 1000, assumeStaples: false }), inventory: [], priceBook: book, adhoc });
    const all = computeBudget({ plan, recipes, household: household({ weeklyBudgetPence: 1000, assumeStaples: false, budgetScope: "all-groceries" }), inventory: [], priceBook: book, adhoc });
    expect(meals.spendPence).toBe(360);
    expect(all.spendPence).toBe(510);
  });

  it("does not charge leftovers again", () => {
    const leftoverPlan = { meals: [meal("m1", "curry", 4), meal("m2", "curry", 2, { kind: "leftover", leftoverOf: "m1", date: "2026-10-13" })] };
    const b = computeBudget({ plan: leftoverPlan, recipes, household: household({ assumeStaples: false }), inventory: [], priceBook: book });
    const leftoverCost = b.mealCosts.find((c) => c.meal.id === "m2")!;
    expect(leftoverCost.consumptionPence).toBe(0);
    expect(leftoverCost.perPortionPence).toBeGreaterThan(0);
  });
});

describe("price book precedence and demo labelling", () => {
  it("prefers manual prices over demonstration data", () => {
    const pb = PriceBook.withDemo([product("rice", 1000, 150)]);
    const list = pb.products("tesco", "rice");
    expect(list.every((p) => p.source === "manual")).toBe(true);
    expect(pb.unitPrice("tesco", "rice")!.pencePerUnit).toBeCloseTo(0.15);
  });

  it("labels every bundled price as demonstration data with no last-checked date", () => {
    const demo = demoProducts();
    expect(demo.length).toBeGreaterThan(100);
    expect(demo.every((p) => p.source === "demo" && p.confidence === "low" && p.lastChecked === undefined)).toBe(true);
  });

  it("gives an uncertainty range around estimates", () => {
    const r = recipe("r", [["rice", 1000, "g"]]);
    const lines = consolidate(recipeRequirements(r, 4), { priceBook: PriceBook.withDemo(), supermarket: "aldi" });
    const e = sumLines(lines, "purchaseCost");
    expect(e.low).toBeLessThan(e.pence);
    expect(e.high).toBeGreaterThan(e.pence);
  });
});
