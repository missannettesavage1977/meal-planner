import { describe, expect, it } from "vitest";
import { INGREDIENT_BY_ID } from "@/lib/data/ingredients";
import { convertStandard, formatBaseQuantity, formatNumber, normaliseUnit, toBase } from "@/lib/engine/units";

const ing = (id: string) => INGREDIENT_BY_ID[id];

describe("unit normalisation", () => {
  it("maps common spellings to canonical units", () => {
    expect(normaliseUnit("Tablespoons")).toBe("tbsp");
    expect(normaliseUnit("tsp.")).toBe("tsp");
    expect(normaliseUnit("litres")).toBe("l");
    expect(normaliseUnit("Kilograms")).toBe("kg");
    expect(normaliseUnit("cans")).toBe("tin");
    expect(normaliseUnit("cloves")).toBe("clove");
    expect(normaliseUnit("large")).toBe("item");
  });
});

describe("compatible conversions", () => {
  it("converts within mass and volume", () => {
    expect(convertStandard(1.5, "kg", "g")).toBe(1500);
    expect(convertStandard(2, "tbsp", "ml")).toBe(30);
    expect(convertStandard(3, "tsp", "tbsp")).toBe(1);
    expect(convertStandard(1, "pint", "ml")).toBe(568);
  });

  it("refuses to convert between mass and volume without ingredient data", () => {
    expect(convertStandard(100, "g", "ml")).toBeNull();
    expect(convertStandard(1, "tbsp", "g")).toBeNull();
  });

  it("converts to an ingredient's base unit", () => {
    expect(toBase(ing("rice"), 0.5, "kg")).toBe(500);
    expect(toBase(ing("milk"), 1, "pint")).toBe(568); // custom unit
    expect(toBase(ing("chopped-tomatoes"), 2, "tins")).toBe(800);
    expect(toBase(ing("garlic"), 1, "bulb")).toBe(10);
    expect(toBase(ing("onion"), 300, "g")).toBe(2); // 150 g per onion
    expect(toBase(ing("onion"), 2, "large")).toBe(2);
  });

  it("uses ingredient density for spoon measures of dry goods", () => {
    // 1 tsp ground cumin = 5 ml × 0.5 g/ml = 2.5 g
    expect(toBase(ing("ground-cumin"), 1, "tsp")).toBeCloseTo(2.5);
    // flour 0.53 g/ml: 1 cup (250 ml) = 132.5 g
    expect(toBase(ing("plain-flour"), 1, "cup")).toBeCloseTo(132.5);
  });

  it("returns null rather than guessing for unsupported conversions", () => {
    expect(toBase(ing("spinach"), 2, "tbsp")).toBeNull(); // no density for spinach
    expect(toBase(ing("salmon-fillets"), 1, "bunch")).toBeNull();
    expect(toBase(ing("broccoli"), 100, "ml")).toBeNull();
    expect(toBase(ing("eggs"), 1, "tbsp")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats fractions kindly", () => {
    expect(formatNumber(3.5)).toBe("3½");
    expect(formatNumber(0.25)).toBe("¼");
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(1.333)).toBe("1⅓");
  });

  it("formats base quantities", () => {
    expect(formatBaseQuantity(1500, "g")).toBe("1.5kg");
    expect(formatBaseQuantity(3.5, "item", ing("onion"))).toBe("3½");
    expect(formatBaseQuantity(6, "item", ing("garlic"))).toBe("6 cloves");
    expect(formatBaseQuantity(30, "ml")).toBe("2 tbsp");
  });
});
