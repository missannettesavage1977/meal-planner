import { describe, expect, it } from "vitest";
import { consolidate, planRequirements, recipeRequirements, type Requirement } from "@/lib/engine/consolidate";
import { PriceBook, choosePacks } from "@/lib/pricing/priceBook";
import { inv, product, recipe } from "./helpers";

const emptyBook = new PriceBook([]);
const opts = { priceBook: emptyBook, supermarket: "tesco" as const };

function reqsOf(...recipes: ReturnType<typeof recipe>[]): Requirement[] {
  return recipes.flatMap((r) => recipeRequirements(r, r.servings));
}

describe("ingredient consolidation", () => {
  it("adds 1 + 2 + ½ onions across three recipes to 3½ onions", () => {
    const a = recipe("a", [["onion", 1, "item"]]);
    const b = recipe("b", [["onion", 2, "item"]]);
    const c = recipe("c", [["onion", 0.5, "item"]]);
    const lines = consolidate(reqsOf(a, b, c), opts);
    expect(lines).toHaveLength(1);
    expect(lines[0].required).toBe(3.5);
    expect(lines[0].recipes.map((r) => r.recipeId).sort()).toEqual(["a", "b", "c"]);
    // purchase rounding to whole onions using catalogue pack sizes
    expect(lines[0].purchase?.quantity).toBe(4);
  });

  it("merges different but compatible units (g + kg, tbsp + ml)", () => {
    const a = recipe("a", [["rice", 300, "g"], ["milk", 2, "tbsp"]]);
    const b = recipe("b", [["rice", 0.5, "kg"], ["milk", 200, "ml"]]);
    const lines = consolidate(reqsOf(a, b), opts);
    const rice = lines.find((l) => l.ingredientId === "rice")!;
    const milk = lines.find((l) => l.ingredientId === "milk")!;
    expect(rice.required).toBe(800);
    expect(rice.unit).toBe("g");
    expect(milk.required).toBe(230);
    expect(milk.unit).toBe("ml");
  });

  it("merges free-text names that only differ by plural form or prep words", () => {
    const a = recipe("a", [[null, 1, "tbsp", "Tahini"]]);
    const b = recipe("b", [[null, 2, "tsp", "tahini, stirred"]]);
    const lines = consolidate(reqsOf(a, b), opts);
    expect(lines).toHaveLength(1);
    expect(lines[0].required).toBe(25); // 15 ml + 10 ml
  });

  it("does not merge fresh and dried/ground forms", () => {
    const a = recipe("a", [["fresh-coriander", 20, "g"]]);
    const b = recipe("b", [["ground-coriander", 1, "tsp"]]);
    const c = recipe("c", [["dried-oregano", 1, "tsp"], ["fresh-basil", 10, "g"]]);
    const lines = consolidate(reqsOf(a, b, c), opts);
    expect(lines.map((l) => l.ingredientId).sort()).toEqual(["dried-oregano", "fresh-basil", "fresh-coriander", "ground-coriander"]);
  });

  it("keeps unconvertible units on a separate line with a warning", () => {
    const a = recipe("a", [["spinach", 100, "g"]]);
    const b = recipe("b", [["spinach", 2, "tbsp"]]); // no density data for spinach
    const lines = consolidate(reqsOf(a, b), opts);
    expect(lines).toHaveLength(2);
    const grams = lines.find((l) => l.unit === "g")!;
    const spoons = lines.find((l) => l.unit === "tbsp")!;
    expect(grams.required).toBe(100);
    expect(spoons.required).toBe(2);
    expect(grams.warnings.join(" ")).toMatch(/can't be safely converted/);
  });

  it("never merges free-text weight with free-text volume", () => {
    const a = recipe("a", [[null, 100, "g", "miso paste"]]);
    const b = recipe("b", [[null, 2, "tbsp", "miso paste"]]);
    expect(consolidate(reqsOf(a, b), opts)).toHaveLength(2);
  });
});

describe("serving size scaling", () => {
  it("scales quantities with planned servings", () => {
    const r = recipe("r", [["beef-mince", 500, "g"], ["onion", 1, "item"]], 4);
    const reqs = recipeRequirements(r, 6);
    expect(reqs.find((q) => q.ingredientId === "beef-mince")!.quantity).toBe(750);
    expect(reqs.find((q) => q.ingredientId === "onion")!.quantity).toBe(1.5);
  });

  it("scales whole plans, ignoring leftovers and cooked meals", () => {
    const r = recipe("r", [["rice", 200, "g"]], 2);
    const plan = {
      meals: [
        { id: "m1", date: "2026-10-12", slot: "dinner" as const, recipeId: "r", servings: 4, locked: false, cooked: false, kind: "cook" as const },
        { id: "m2", date: "2026-10-13", slot: "dinner" as const, recipeId: "r", servings: 2, locked: false, cooked: false, kind: "leftover" as const, leftoverOf: "m1" },
        { id: "m3", date: "2026-10-14", slot: "dinner" as const, recipeId: "r", servings: 2, locked: false, cooked: true, kind: "cook" as const },
      ],
    };
    const reqs = planRequirements(plan, { r });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].quantity).toBe(400);
  });
});

describe("inventory subtraction", () => {
  it("requests only the remainder: 500 g rice needed, 200 g at home → 300 g", () => {
    const r = recipe("r", [["rice", 500, "g"]]);
    const lines = consolidate(reqsOf(r), { ...opts, inventory: [inv("basmati rice", 200, "g")] });
    expect(lines[0].required).toBe(500);
    expect(lines[0].available).toBe(200);
    expect(lines[0].shortfall).toBe(300);
    expect(lines[0].toBuy).toBe(300);
  });

  it("converts inventory units and applies the 'remaining' estimate", () => {
    const r = recipe("r", [["milk", 1000, "ml"]]);
    const lines = consolidate(reqsOf(r), { ...opts, inventory: [inv("semi-skimmed milk", 2, "pints", { remaining: 0.5 })] });
    expect(lines[0].available).toBe(568);
    expect(lines[0].shortfall).toBe(432);
  });

  it("treats 'have some' (no amount) as covering the need", () => {
    const r = recipe("r", [["ground-cumin", 1, "tsp"]]);
    const lines = consolidate(reqsOf(r), { ...opts, inventory: [inv("cumin", null, "")] });
    expect(lines[0].toBuy).toBe(0);
    expect(lines[0].coveredByUnknownInventory).toBe(true);
  });

  it("never counts the same inventory twice across lines", () => {
    const r1 = recipe("a", [["rice", 300, "g"]]);
    const r2 = recipe("b", [["rice", 300, "g"]]);
    const lines = consolidate(reqsOf(r1, r2), { ...opts, inventory: [inv("rice", 400, "g")] });
    expect(lines).toHaveLength(1);
    expect(lines[0].available).toBe(400);
    expect(lines[0].shortfall).toBe(200);
  });

  it("respects manual 'already have' marks and quantity overrides", () => {
    const r = recipe("r", [["rice", 500, "g"], ["onion", 2, "item"]]);
    const lines = consolidate(reqsOf(r), { ...opts, shopping: { owned: { rice: true }, overrides: { onion: 5 } } });
    expect(lines.find((l) => l.key === "rice")!.toBuy).toBe(0);
    expect(lines.find((l) => l.key === "onion")!.toBuy).toBe(5);
  });
});

describe("pack rounding", () => {
  it("rounds up to whole packs and picks the cheapest combination", () => {
    const products = [product("rice", 500, 115), product("rice", 1000, 199)];
    const plan = choosePacks(1200, products)!;
    // options: 3×500 = 345p, 1×1000 + 1×500 = 314p, 2×1000 = 398p
    expect(plan.costPence).toBe(314);
    expect(plan.quantity).toBe(1500);
    expect(plan.surplus).toBe(300);
  });

  it("buys loose items when cheaper than a multipack", () => {
    const products = [product("onion", 1, 18), product("onion", 7, 89)];
    const plan = choosePacks(3.5, products)!;
    expect(plan.packs).toEqual([expect.objectContaining({ size: 1, count: 4 })]);
    expect(plan.costPence).toBe(72);
  });

  it("buys nothing when nothing is needed", () => {
    expect(choosePacks(0, [product("rice", 500, 115)])!.packs).toHaveLength(0);
  });

  it("falls back to typical pack sizes without price data", () => {
    const plan = choosePacks(650, [], [{ size: 500, label: "500g bag" }])!;
    expect(plan.quantity).toBe(1000);
    expect(plan.priced).toBe(false);
    expect(plan.costPence).toBeUndefined();
  });
});

describe("staples", () => {
  it("does not add cupboard staples to the bill when assumed", () => {
    const r = recipe("r", [["salt", 1, "tsp"], ["olive-oil", 2, "tbsp"], ["rice", 100, "g"]]);
    const lines = consolidate(reqsOf(r), { ...opts, assumeStaples: true, cupboardStaples: ["salt", "olive-oil"] });
    expect(lines.find((l) => l.key === "salt")!.toBuy).toBe(0);
    expect(lines.find((l) => l.key === "olive-oil")!.staple).toBe(true);
    expect(lines.find((l) => l.key === "rice")!.toBuy).toBe(100);
  });
});
