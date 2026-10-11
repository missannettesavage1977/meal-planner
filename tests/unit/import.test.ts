import { describe, expect, it } from "vitest";
import { parseIngredientLine, parseRecipeText } from "@/lib/engine/importText";

describe("ingredient line parsing", () => {
  it.each([
    ["200g basmati rice", 200, "g", "rice"],
    ["2 tbsp olive oil", 2, "tbsp", "olive-oil"],
    ["1 1/2 tsp ground cumin", 1.5, "tsp", "ground-cumin"],
    ["½ tsp chilli flakes", 0.5, "tsp", "chilli-flakes"],
    ["2 x 400g tins chopped tomatoes", 800, "g", "chopped-tomatoes"],
    ["1 tin (400g) chickpeas, drained", 1, "tin", "chickpeas"],
    ["3 garlic cloves, crushed", 3, "item", "garlic"],
    ["1 large onion, finely chopped", 1, "item", "onion"],
    ["a pinch of salt", 1, "pinch", "salt"],
    ["500 g beef mince", 500, "g", "beef-mince"],
    ["- 2 courgettes", 2, "item", "courgette"],
  ])("%s", (line, qty, unit, id) => {
    const p = parseIngredientLine(line)!;
    expect(p.quantity).toBeCloseTo(qty);
    expect(p.unit).toBe(unit);
    expect(p.ingredientId).toBe(id);
  });

  it("keeps notes and flags optional ingredients", () => {
    const p = parseIngredientLine("fresh coriander, to serve (optional)")!;
    expect(p.ingredientId).toBe("fresh-coriander");
    expect(p.optional).toBe(true);
  });

  it("leaves unknown ingredients unmatched for review", () => {
    const p = parseIngredientLine("2 tbsp gochujang")!;
    expect(p.ingredientId).toBeNull();
    expect(p.matched).toBe(false);
    expect(p.name).toBe("gochujang");
  });
});

describe("recipe text import", () => {
  const text = `Easy Veggie Curry
Serves 4
Prep time: 10 mins
Cook time: 1 hr 5 mins

Ingredients
1 onion, chopped
2 x 400g tins chickpeas
400ml coconut milk
2 tbsp curry powder
1 tbsp gochujang

Method
1. Fry the onion until soft.
2. Add everything else and simmer for 20 minutes.`;

  it("extracts title, servings, times, ingredients and steps", () => {
    const r = parseRecipeText(text);
    expect(r.name).toBe("Easy Veggie Curry");
    expect(r.servings).toBe(4);
    expect(r.prepMins).toBe(10);
    expect(r.cookMins).toBe(65);
    expect(r.ingredients).toHaveLength(5);
    expect(r.ingredients[1]).toMatchObject({ ingredientId: "chickpeas", quantity: 800, unit: "g" });
    expect(r.steps).toEqual(["Fry the onion until soft.", "Add everything else and simmer for 20 minutes."]);
    expect(r.warnings.join(" ")).toMatch(/not recognised \(gochujang\)/);
  });

  it("warns when sections are missing", () => {
    const r = parseRecipeText("Just a title");
    expect(r.warnings.length).toBeGreaterThan(1);
  });
});

describe("week request parsing (on-device)", async () => {
  const { parseWeekRequestLocally, applyWeekRequest } = await import("@/lib/engine/weekRequest");
  const { DEFAULT_HOUSEHOLD } = await import("@/lib/domain/types");

  it("understands common requests", () => {
    const r = parseWeekRequestLocally("Cheap veggie meals please, no mushrooms, something Mexican, under 30 mins on weeknights");
    expect(r.diets).toContain("vegetarian");
    expect(r.avoid).toContain("mushrooms");
    expect(r.cuisines).toContain("mexican");
    expect(r.maxWeeknightMins).toBe(30);
    expect(r.saveMoney).toBe(true);
  });

  it("only ever tightens household restrictions", () => {
    const h = { ...DEFAULT_HOUSEHOLD, allergens: ["peanuts" as const], diets: ["no-pork" as const], weeknightMaxMins: 25 };
    const applied = applyWeekRequest(h, parseWeekRequestLocally("vegan, under 60 mins"));
    expect(applied.allergens).toEqual(["peanuts"]);
    expect(applied.diets).toEqual(expect.arrayContaining(["no-pork", "vegan"]));
    expect(applied.weeknightMaxMins).toBe(25);
  });
});
