import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Reference enums                                                     */
/* ------------------------------------------------------------------ */

/** The 14 allergens UK food law requires businesses to declare. */
export const ALLERGENS = [
  "celery",
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "lupin",
  "milk",
  "molluscs",
  "mustard",
  "tree-nuts",
  "peanuts",
  "sesame",
  "soya",
  "sulphites",
] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const AllergenSchema = z.enum(ALLERGENS);

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  celery: "Celery",
  gluten: "Cereals containing gluten",
  crustaceans: "Crustaceans",
  eggs: "Eggs",
  fish: "Fish",
  lupin: "Lupin",
  milk: "Milk",
  molluscs: "Molluscs",
  mustard: "Mustard",
  "tree-nuts": "Tree nuts",
  peanuts: "Peanuts",
  sesame: "Sesame",
  soya: "Soya",
  sulphites: "Sulphites",
};

export const SUPERMARKETS = ["tesco", "sainsburys", "asda", "aldi", "lidl", "morrisons"] as const;
export type Supermarket = (typeof SUPERMARKETS)[number];
export const SupermarketSchema = z.enum(SUPERMARKETS);
export const SUPERMARKET_LABELS: Record<Supermarket, string> = {
  tesco: "Tesco",
  sainsburys: "Sainsbury's",
  asda: "Asda",
  aldi: "Aldi",
  lidl: "Lidl",
  morrisons: "Morrisons",
};

export const DIETS = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "gluten-free",
  "dairy-free",
  "no-pork",
  "no-beef",
] as const;
export type Diet = (typeof DIETS)[number];
export const DietSchema = z.enum(DIETS);
export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "no-pork": "No pork",
  "no-beef": "No beef",
};

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const MealSlotSchema = z.enum(MEAL_SLOTS);

export const EQUIPMENT = ["hob", "oven", "microwave", "slow-cooker", "air-fryer", "blender"] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const EquipmentSchema = z.enum(EQUIPMENT);
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  hob: "Hob",
  oven: "Oven",
  microwave: "Microwave",
  "slow-cooker": "Slow cooker",
  "air-fryer": "Air fryer",
  blender: "Blender / stick blender",
};

export const CUISINES = [
  "british",
  "italian",
  "indian",
  "chinese",
  "thai",
  "mexican",
  "middle-eastern",
  "caribbean",
  "spanish",
  "moroccan",
  "american",
] as const;
export type Cuisine = (typeof CUISINES)[number];
export const CuisineSchema = z.enum(CUISINES);
export const CUISINE_LABELS: Record<Cuisine, string> = {
  british: "British",
  italian: "Italian",
  indian: "Indian",
  chinese: "Chinese",
  thai: "Thai",
  mexican: "Mexican",
  "middle-eastern": "Middle Eastern",
  caribbean: "Caribbean",
  spanish: "Spanish",
  moroccan: "Moroccan",
  american: "American",
};

export const CATEGORIES = [
  "Fruit & veg",
  "Fresh herbs",
  "Meat & poultry",
  "Fish & seafood",
  "Dairy & eggs",
  "Chilled",
  "Bakery",
  "Frozen",
  "Tins & jars",
  "Pasta, rice & grains",
  "Herbs & spices",
  "Oils, sauces & condiments",
  "Baking & cereals",
  "World foods",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const CategorySchema = z.enum(CATEGORIES);

export const SKILL_LEVELS = ["beginner", "confident", "keen"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

/** Canonical base units. Every catalogue ingredient stores quantities in one of these. */
export const BASE_UNITS = ["g", "ml", "item"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];
export const BaseUnitSchema = z.enum(BASE_UNITS);

/* ------------------------------------------------------------------ */
/* Ingredient catalogue                                                */
/* ------------------------------------------------------------------ */

/**
 * Strictest diet an ingredient is compatible with.
 * vegan ⊂ vegetarian ⊂ pescatarian ⊂ meat.
 */
export type DietLevel = "vegan" | "vegetarian" | "pescatarian" | "meat";

export interface PackSize {
  /** Size in the ingredient's base unit. */
  size: number;
  /** Human label, e.g. "1kg bag" or "bunch". */
  label: string;
}

export interface IngredientDef {
  id: string;
  name: string;
  /** Plural display name for count-based ingredients (e.g. "onions"). */
  plural?: string;
  aliases: string[];
  category: Category;
  baseUnit: BaseUnit;
  /** Label for one base "item" (e.g. "clove" for garlic, "slice" for bread). */
  itemLabel?: string;
  itemLabelPlural?: string;
  /** Typical weight in grams of one item, enabling g ↔ item conversion. */
  gramsPerItem?: number;
  /** Ingredient-specific density in g/ml, enabling g ↔ ml conversion. */
  density?: number;
  /** Ingredient-specific units, expressed in the base unit (e.g. tin → 400 g). */
  customUnits?: Record<string, number>;
  allergens: Allergen[];
  /** "May contain" / commonly present allergens. Treated as strict exclusions. */
  mayContain?: Allergen[];
  diet: DietLevel;
  /** Extra tags used for diet filters (e.g. "pork", "beef"). */
  tags?: string[];
  /** Typical chilled/fresh shelf life once bought, in days. */
  shelfLifeDays: number;
  /** Store-cupboard staple most kitchens already have (salt, oil...). */
  staple?: boolean;
  /** The main protein family, used for variety scoring. */
  protein?: string;
  /** Typical pack sizes (base units). Used when no product price data exists. */
  packs: PackSize[];
  /** Short allergen/diet note shown in the UI. */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Recipes                                                             */
/* ------------------------------------------------------------------ */

export const RecipeIngredientSchema = z.object({
  /** Catalogue id; null for free-text ingredients from imported/user recipes. */
  ingredientId: z.string().nullable(),
  /** Display name (used for free-text ingredients and for notes). */
  name: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  note: z.string().optional(),
  optional: z.boolean().optional(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const SubstitutionSchema = z.object({
  ingredientId: z.string(),
  alternatives: z.array(
    z.object({
      ingredientId: z.string().nullable(),
      name: z.string(),
      ratio: z.number().positive().default(1),
      note: z.string().optional(),
    }),
  ),
});
export type Substitution = z.infer<typeof SubstitutionSchema>;

export const NutritionSchema = z.object({
  kcal: z.number().nonnegative(),
  proteinG: z.number().nonnegative().optional(),
  carbsG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  source: z.string(),
});

export const RecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Give the recipe a name"),
  description: z.string().default(""),
  cuisine: CuisineSchema.or(z.literal("other")).default("other"),
  mealTypes: z.array(MealSlotSchema).min(1),
  servings: z.number().int().min(1).max(24),
  prepMins: z.number().int().min(0).max(600),
  cookMins: z.number().int().min(0).max(1440),
  ingredients: z.array(RecipeIngredientSchema).min(1, "Add at least one ingredient"),
  steps: z.array(z.string().min(1)).min(1, "Add at least one step"),
  storage: z.string().optional(),
  /** Days leftovers keep in the fridge; 0 = not suitable for leftovers. */
  keepsDays: z.number().int().min(0).max(7).default(0),
  freezable: z.boolean().default(false),
  substitutions: z.array(SubstitutionSchema).default([]),
  tags: z.array(z.string()).default([]),
  equipment: z.array(EquipmentSchema).default([]),
  difficulty: z.enum(["easy", "medium", "confident"]).default("easy"),
  nutrition: NutritionSchema.optional(),
  emoji: z.string().default("🍽️"),
  hue: z.number().min(0).max(360).default(30),
  imageUrl: z.string().url().optional(),
  source: z.enum(["original", "user", "imported"]).default("original"),
  sourceNote: z.string().optional(),
});
export type Recipe = z.infer<typeof RecipeSchema>;

/* ------------------------------------------------------------------ */
/* Household                                                           */
/* ------------------------------------------------------------------ */

export const PlannerWeightsSchema = z.object({
  preference: z.number().min(0).max(5),
  cost: z.number().min(0).max(5),
  inventory: z.number().min(0).max(5),
  overlap: z.number().min(0).max(5),
  waste: z.number().min(0).max(5),
  time: z.number().min(0).max(5),
  variety: z.number().min(0).max(5),
  health: z.number().min(0).max(5),
  priceConfidence: z.number().min(0).max(5),
});
export type PlannerWeights = z.infer<typeof PlannerWeightsSchema>;

export const DEFAULT_WEIGHTS: PlannerWeights = {
  preference: 2,
  cost: 2,
  inventory: 2,
  overlap: 1.5,
  waste: 1.5,
  time: 1.5,
  variety: 2,
  health: 1,
  priceConfidence: 0.5,
};

export const HouseholdSchema = z.object({
  adults: z.number().int().min(1).max(12),
  children: z.number().int().min(0).max(12),
  /** Portions to cook per meal (children counted as ~0.5 by default). */
  portionsPerMeal: z.number().min(1).max(24),
  supermarket: SupermarketSchema,
  weeklyBudgetPence: z.number().int().min(0).max(100_000_00),
  budgetScope: z.enum(["planned-meals", "all-groceries"]),
  slots: z.array(MealSlotSchema).min(1),
  /** Days of the week to plan (0 = Monday … 6 = Sunday). */
  planDays: z.array(z.number().int().min(0).max(6)).min(1),
  weeknightMaxMins: z.number().int().min(10).max(240),
  weekendMaxMins: z.number().int().min(10).max(300),
  skill: z.enum(SKILL_LEVELS),
  equipment: z.array(EquipmentSchema),
  diets: z.array(DietSchema),
  allergens: z.array(AllergenSchema),
  /** Free-text allergy/intolerance terms matched against ingredient names (strict). */
  allergyTerms: z.array(z.string()),
  dislikes: z.array(z.string()),
  cuisines: z.array(CuisineSchema),
  favourites: z.string().default(""),
  batchCooking: z.boolean(),
  leftoversPerWeek: z.number().int().min(0).max(4),
  priorities: z.object({
    health: z.number().min(0).max(3),
    convenience: z.number().min(0).max(3),
    variety: z.number().min(0).max(3),
    savings: z.number().min(0).max(3),
  }),
  assumeStaples: z.boolean(),
  /** Ingredient ids the household always keeps in (salt, oil, stock cubes…). Not added to the shopping bill. */
  cupboardStaples: z.array(z.string()),
  weights: PlannerWeightsSchema,
});
export type Household = z.infer<typeof HouseholdSchema>;

export const DEFAULT_HOUSEHOLD: Household = {
  adults: 2,
  children: 0,
  portionsPerMeal: 2,
  supermarket: "tesco",
  weeklyBudgetPence: 6000,
  budgetScope: "planned-meals",
  slots: ["dinner"],
  planDays: [0, 1, 2, 3, 4, 5, 6],
  weeknightMaxMins: 45,
  weekendMaxMins: 90,
  skill: "confident",
  equipment: ["hob", "oven", "microwave"],
  diets: [],
  allergens: [],
  allergyTerms: [],
  dislikes: [],
  cuisines: [],
  favourites: "",
  batchCooking: true,
  leftoversPerWeek: 1,
  priorities: { health: 2, convenience: 2, variety: 2, savings: 2 },
  assumeStaples: true,
  cupboardStaples: ["salt", "black-pepper", "vegetable-oil", "olive-oil", "veg-stock-cube", "sugar"],
  weights: DEFAULT_WEIGHTS,
};

/* ------------------------------------------------------------------ */
/* Meal plans                                                          */
/* ------------------------------------------------------------------ */

export const PlannedMealSchema = z.object({
  id: z.string(),
  /** ISO date, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: MealSlotSchema,
  recipeId: z.string(),
  /** Portions to cook. For a meal that feeds later leftovers this includes them. */
  servings: z.number().min(0.5).max(48),
  locked: z.boolean().default(false),
  cooked: z.boolean().default(false),
  kind: z.enum(["cook", "leftover"]).default("cook"),
  /** For leftovers: id of the meal that was cooked in bulk. */
  leftoverOf: z.string().optional(),
  reasons: z.array(z.string()).optional(),
  score: z.number().optional(),
  /** Chosen substitutions: original ingredient id → alternative index. */
  substitutions: z.record(z.string(), z.number().int().min(0)).optional(),
});
export type PlannedMeal = z.infer<typeof PlannedMealSchema>;

export const MealPlanSchema = z.object({
  id: z.string(),
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: z.string(),
  meals: z.array(PlannedMealSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MealPlan = z.infer<typeof MealPlanSchema>;

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export const STORAGE_LOCATIONS = ["cupboard", "fridge", "freezer"] as const;
export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

export const InventoryItemSchema = z.object({
  id: z.string(),
  ingredientId: z.string().nullable(),
  name: z.string().min(1, "Enter a name"),
  /** null means "I have some" without a recorded amount. */
  quantity: z.number().nonnegative().nullable(),
  unit: z.string(),
  location: z.enum(STORAGE_LOCATIONS),
  purchasedOn: z.string().optional(),
  dateType: z.enum(["use-by", "best-before"]).optional(),
  date: z.string().optional(),
  /** Optional estimate of how much is left (fraction 0–1). */
  remaining: z.number().min(0).max(1).optional(),
  addedAt: z.string(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

export const PriceSourceSchema = z.enum(["demo", "manual", "provider"]);
export type PriceSource = z.infer<typeof PriceSourceSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  supermarket: SupermarketSchema,
  ingredientId: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  ownBrand: z.boolean(),
  /** Pack size in the ingredient's base unit. */
  packSize: z.number().positive(),
  packLabel: z.string(),
  /** Pack price in pence. */
  pricePence: z.number().int().nonnegative(),
  url: z.string().url().optional(),
  /** ISO date the price was last checked against the retailer; absent for demo data. */
  lastChecked: z.string().optional(),
  source: PriceSourceSchema,
  confidence: z.enum(["low", "medium", "high"]),
});
export type Product = z.infer<typeof ProductSchema>;

/* ------------------------------------------------------------------ */
/* Shopping list state                                                 */
/* ------------------------------------------------------------------ */

export const AdhocItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  quantity: z.string().default(""),
  category: CategorySchema,
  pricePence: z.number().int().nonnegative().optional(),
  checked: z.boolean().default(false),
});
export type AdhocItem = z.infer<typeof AdhocItemSchema>;

export const ShoppingStateSchema = z.object({
  /** keyed by shopping line key */
  checked: z.record(z.string(), z.boolean()),
  owned: z.record(z.string(), z.boolean()),
  /** Manual purchase quantity in the line's base unit. */
  overrides: z.record(z.string(), z.number().nonnegative()),
  adhoc: z.array(AdhocItemSchema),
});
export type ShoppingState = z.infer<typeof ShoppingStateSchema>;
