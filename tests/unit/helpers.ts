import { INGREDIENT_BY_ID } from "@/lib/data/ingredients";
import { DEFAULT_HOUSEHOLD, type Household, type InventoryItem, type Product, type Recipe } from "@/lib/domain/types";

export function recipe(id: string, lines: [string | null, number, string, string?][], servings = 4, extra: Partial<Recipe> = {}): Recipe {
  return {
    id,
    name: extra.name ?? id,
    description: "",
    cuisine: "british",
    mealTypes: ["dinner"],
    servings,
    prepMins: 10,
    cookMins: 20,
    ingredients: lines.map(([ingredientId, quantity, unit, name]) => ({
      ingredientId,
      name: name ?? (ingredientId ? INGREDIENT_BY_ID[ingredientId].name : "unknown"),
      quantity,
      unit,
    })),
    steps: ["Cook it."],
    keepsDays: 0,
    freezable: false,
    substitutions: [],
    tags: [],
    equipment: ["hob"],
    difficulty: "easy",
    emoji: "🍽️",
    hue: 0,
    source: "user",
    ...extra,
  };
}

export function inv(name: string, quantity: number | null, unit: string, extra: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: `inv-${name}-${Math.random()}`,
    ingredientId: null,
    name,
    quantity,
    unit,
    location: "cupboard",
    addedAt: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

export function product(ingredientId: string, packSize: number, pricePence: number, extra: Partial<Product> = {}): Product {
  return {
    id: `p-${ingredientId}-${packSize}-${pricePence}`,
    supermarket: "tesco",
    ingredientId,
    name: `${ingredientId} ${packSize}`,
    ownBrand: true,
    packSize,
    packLabel: `${packSize} pack`,
    pricePence,
    source: "manual",
    confidence: "high",
    ...extra,
  };
}

export function household(patch: Partial<Household> = {}): Household {
  return { ...DEFAULT_HOUSEHOLD, ...patch };
}
