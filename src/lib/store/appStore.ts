"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";
import { SEED_RECIPES } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import {
  AdhocItemSchema,
  DEFAULT_HOUSEHOLD,
  HouseholdSchema,
  InventoryItemSchema,
  MealPlanSchema,
  ProductSchema,
  RecipeSchema,
  type AdhocItem,
  type Household,
  type InventoryItem,
  type MealPlan,
  type MealSlot,
  type PlannedMeal,
  type Product,
  type Recipe,
  type ShoppingState,
} from "../domain/types";
import { PriceBook } from "../pricing/priceBook";
import {
  addLeftover as addLeftoverFn,
  copyPlanToWeek,
  fitToBudget,
  generatePlan,
  moveMeal as moveMealFn,
  rankCandidates,
  removeMeal as removeMealFn,
  replaceMeal as replaceMealFn,
  setServings as setServingsFn,
  sortMeals,
  type BudgetSwap,
  type PlannerContext,
} from "../engine/planner";
import { inventoryKey } from "../engine/consolidate";
import { applySubstitutions } from "../engine/substitutions";
import { applyWeekRequest, type WeekRequest } from "../engine/weekRequest";
import { toBase } from "../engine/units";
import { newId } from "../utils/ids";
import { todayISO, weekStartOf } from "../utils/dates";

export const STORAGE_KEY = "ukmp-state";
export const STATE_VERSION = 1;

export interface AppData {
  onboarded: boolean;
  household: Household;
  userRecipes: Recipe[];
  favouriteRecipeIds: string[];
  plans: MealPlan[];
  inventory: InventoryItem[];
  /** Shopping list state per week (keyed by week start). */
  shopping: Record<string, ShoppingState>;
  manualProducts: Product[];
  seed: number;
}

export const AppDataSchema = z.object({
  onboarded: z.boolean(),
  household: HouseholdSchema,
  userRecipes: z.array(RecipeSchema),
  favouriteRecipeIds: z.array(z.string()),
  plans: z.array(MealPlanSchema),
  inventory: z.array(InventoryItemSchema),
  shopping: z.record(
    z.string(),
    z.object({
      checked: z.record(z.string(), z.boolean()),
      owned: z.record(z.string(), z.boolean()),
      overrides: z.record(z.string(), z.number()),
      adhoc: z.array(AdhocItemSchema),
    }),
  ),
  manualProducts: z.array(ProductSchema),
  seed: z.number(),
});

export const initialData = (): AppData => ({
  onboarded: false,
  household: DEFAULT_HOUSEHOLD,
  userRecipes: [],
  favouriteRecipeIds: [],
  plans: [],
  inventory: [],
  shopping: {},
  manualProducts: [],
  seed: 1,
});

const EMPTY_SHOPPING: ShoppingState = { checked: {}, owned: {}, overrides: {}, adhoc: [] };

export interface ActionResult {
  ok: boolean;
  message?: string;
  notes?: string[];
  swaps?: BudgetSwap[];
}

interface Actions {
  completeOnboarding(h: Household): void;
  updateHousehold(patch: Partial<Household>): void;

  ensurePlan(weekStart: string): MealPlan;
  generateWeek(weekStart: string, dates?: string[], request?: WeekRequest): ActionResult;
  addMeal(weekStart: string, date: string, slot: MealSlot, recipeId: string): ActionResult;
  replaceMeal(weekStart: string, mealId: string, recipeId: string): ActionResult;
  regenerateMeal(weekStart: string, mealId: string): ActionResult;
  removeMeal(weekStart: string, mealId: string): void;
  moveMeal(weekStart: string, mealId: string, date: string, slot: MealSlot): ActionResult;
  setServings(weekStart: string, mealId: string, servings: number): void;
  toggleLock(weekStart: string, mealId: string): void;
  setCooked(weekStart: string, mealId: string, cooked: boolean, deductInventory?: boolean): ActionResult;
  addLeftover(weekStart: string, mealId: string, date: string, slot: MealSlot): ActionResult;
  setSubstitution(weekStart: string, mealId: string, ingredientId: string, altIndex: number | null): void;
  copyWeek(fromWeek: string, toWeek: string): ActionResult;
  clearWeek(weekStart: string): void;
  fitBudget(weekStart: string): ActionResult;

  addInventory(item: Omit<InventoryItem, "id" | "addedAt">): void;
  updateInventory(id: string, patch: Partial<InventoryItem>): void;
  removeInventory(id: string): void;

  toggleChecked(weekStart: string, key: string): void;
  setOwned(weekStart: string, key: string, owned: boolean): void;
  setOverride(weekStart: string, key: string, qty: number | null): void;
  addAdhoc(weekStart: string, item: Omit<AdhocItem, "id" | "checked">): void;
  toggleAdhoc(weekStart: string, id: string): void;
  removeAdhoc(weekStart: string, id: string): void;
  resetShopping(weekStart: string): void;
  moveCheckedToInventory(weekStart: string, items: { key: string; ingredientId: string | null; name: string; quantity: number; unit: string; location: InventoryItem["location"] }[]): ActionResult;
  toggleAlwaysHave(ingredientId: string): void;

  saveRecipe(recipe: Recipe): void;
  deleteRecipe(id: string): void;
  toggleFavourite(id: string): void;

  addManualProduct(p: Omit<Product, "id" | "source" | "confidence" | "lastChecked"> & { lastChecked?: string }): void;
  removeManualProduct(id: string): void;

  exportData(): string;
  importData(json: string): ActionResult;
  resetAll(): void;
}

export type AppState = AppData & Actions;

/* ------------------------------------------------------------------ */
/* Derived helpers (pure)                                              */
/* ------------------------------------------------------------------ */

let bookCache: { key: Product[]; book: PriceBook } | null = null;
export function priceBookFor(manual: Product[]): PriceBook {
  if (bookCache && bookCache.key === manual) return bookCache.book;
  const book = PriceBook.withDemo(manual);
  bookCache = { key: manual, book };
  return book;
}

let recipeCache: { key: Recipe[]; list: Recipe[]; byId: Record<string, Recipe> } | null = null;
export function allRecipes(userRecipes: Recipe[]): { list: Recipe[]; byId: Record<string, Recipe> } {
  if (recipeCache && recipeCache.key === userRecipes) return recipeCache;
  const list = [...SEED_RECIPES, ...userRecipes];
  recipeCache = { key: userRecipes, list, byId: Object.fromEntries(list.map((r) => [r.id, r])) };
  return recipeCache;
}

export function plannerContext(s: AppData, seed?: number): PlannerContext {
  return {
    household: s.household,
    recipes: allRecipes(s.userRecipes).list,
    inventory: s.inventory,
    priceBook: priceBookFor(s.manualProducts),
    today: todayISO(),
    seed: seed ?? s.seed,
  };
}

export function findPlan(plans: MealPlan[], weekStart: string): MealPlan | undefined {
  return plans.find((p) => p.weekStart === weekStart);
}

function emptyPlan(weekStart: string): MealPlan {
  const now = new Date().toISOString();
  return { id: newId("plan"), weekStart, meals: [], createdAt: now, updatedAt: now };
}

function upsertPlan(plans: MealPlan[], plan: MealPlan): MealPlan[] {
  const others = plans.filter((p) => p.weekStart !== plan.weekStart);
  return [...others, plan].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Reduces inventory by the ingredients a meal used. Items without a recorded
 * quantity are left alone. Returns the updated inventory and a summary.
 */
export function deductInventory(inventory: InventoryItem[], recipe: Recipe, servings: number): { inventory: InventoryItem[]; used: string[] } {
  const factor = servings / recipe.servings;
  const next = inventory.map((i) => ({ ...i }));
  const used: string[] = [];
  for (const line of recipe.ingredients) {
    const ing = getIngredient(line.ingredientId);
    if (!ing) continue;
    let need = toBase(ing, line.quantity * factor, line.unit);
    if (need === null || need <= 0) continue;
    for (const item of next) {
      if (need <= 0) break;
      if (inventoryKey(item) !== ing.id || item.quantity === null) continue;
      const have = toBase(ing, item.quantity * (item.remaining ?? 1), item.unit);
      if (have === null || have <= 0) continue;
      const take = Math.min(have, need);
      need -= take;
      const left = have - take;
      // convert remaining back to the item's own unit
      const perUnit = have / (item.quantity * (item.remaining ?? 1));
      item.quantity = Math.round((left / perUnit) * 100) / 100;
      item.remaining = undefined;
      if (!used.includes(ing.name)) used.push(ing.name);
    }
  }
  return { inventory: next.filter((i) => i.quantity === null || i.quantity > 0.001), used };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const withPlan = (weekStart: string, fn: (p: MealPlan, s: AppState) => MealPlan) => {
        const s = get();
        const plan = findPlan(s.plans, weekStart) ?? emptyPlan(weekStart);
        const next = fn(plan, s);
        set({ plans: upsertPlan(s.plans, { ...next, updatedAt: new Date().toISOString() }) });
      };
      const shoppingFor = (weekStart: string) => get().shopping[weekStart] ?? EMPTY_SHOPPING;
      const setShopping = (weekStart: string, fn: (s: ShoppingState) => ShoppingState) =>
        set({ shopping: { ...get().shopping, [weekStart]: fn(shoppingFor(weekStart)) } });

      return {
        ...initialData(),

        completeOnboarding(h) {
          set({ household: HouseholdSchema.parse(h), onboarded: true });
        },
        updateHousehold(patch) {
          set({ household: HouseholdSchema.parse({ ...get().household, ...patch }) });
        },

        ensurePlan(weekStart) {
          const existing = findPlan(get().plans, weekStart);
          if (existing) return existing;
          const plan = emptyPlan(weekStart);
          set({ plans: upsertPlan(get().plans, plan) });
          return plan;
        },

        generateWeek(weekStart, dates, request) {
          const s = get();
          const seed = s.seed + 1;
          const plan = findPlan(s.plans, weekStart) ?? emptyPlan(weekStart);
          const ctx = plannerContext(s, seed);
          if (request) ctx.household = applyWeekRequest(s.household, request);
          const res = generatePlan(ctx, plan, { dates });
          set({ plans: upsertPlan(s.plans, res.plan), seed });
          const count = res.plan.meals.filter((m) => !dates || dates.includes(m.date)).length;
          return { ok: count > 0, message: count ? `Planned ${count} meal${count === 1 ? "" : "s"}` : "No meals could be planned", notes: res.notes };
        },

        addMeal(weekStart, date, slot, recipeId) {
          const s = get();
          const r = allRecipes(s.userRecipes).byId[recipeId];
          if (!r) return { ok: false, message: "Recipe not found" };
          withPlan(weekStart, (p) => {
            const without = p.meals.find((m) => m.date === date && m.slot === slot);
            const base = without ? removeMealFn(p, without.id, s.household) : p;
            const meal: PlannedMeal = {
              id: newId("meal"),
              date,
              slot,
              recipeId,
              servings: s.household.portionsPerMeal,
              locked: false,
              cooked: false,
              kind: "cook",
              reasons: ["Chosen by you"],
            };
            return { ...base, meals: sortMeals([...base.meals, meal]) };
          });
          return { ok: true, message: `Added ${r.name}` };
        },

        replaceMeal(weekStart, mealId, recipeId) {
          const s = get();
          const r = allRecipes(s.userRecipes).byId[recipeId];
          const plan = findPlan(s.plans, weekStart);
          if (!r || !plan) return { ok: false, message: "Couldn't find that meal" };
          const res = replaceMealFn(plan, mealId, r, s.household);
          set({ plans: upsertPlan(s.plans, res.plan) });
          return { ok: true, message: `Swapped in ${r.name}`, notes: res.notes };
        },

        regenerateMeal(weekStart, mealId) {
          const s = get();
          const plan = findPlan(s.plans, weekStart);
          const meal = plan?.meals.find((m) => m.id === mealId);
          if (!plan || !meal) return { ok: false, message: "Couldn't find that meal" };
          const others = plan.meals.filter((m) => m.id !== mealId && m.leftoverOf !== mealId);
          const seed = s.seed + 1;
          const ctx = plannerContext(s, seed);
          const ranked = rankCandidates(ctx, others, meal.date, meal.slot, { exclude: [meal.recipeId, ...plan.meals.map((m) => m.recipeId)] });
          if (!ranked.length) return { ok: false, message: "No other suitable recipes – try adjusting your preferences." };
          const pick = ranked[Math.floor((seed * 7919) % Math.min(3, ranked.length))] ?? ranked[0];
          const res = replaceMealFn(plan, mealId, pick.recipe, s.household);
          const updated = {
            ...res.plan,
            meals: res.plan.meals.map((m) => (m.id === mealId ? { ...m, reasons: pick.reasons, score: Math.round(pick.score * 100) } : m)),
          };
          set({ plans: upsertPlan(s.plans, updated), seed });
          return { ok: true, message: `Swapped in ${pick.recipe.name}`, notes: res.notes };
        },

        removeMeal(weekStart, mealId) {
          withPlan(weekStart, (p, s) => removeMealFn(p, mealId, s.household));
        },

        moveMeal(weekStart, mealId, date, slot) {
          const s = get();
          const plan = findPlan(s.plans, weekStart);
          if (!plan) return { ok: false };
          const res = moveMealFn(plan, mealId, date, slot, allRecipes(s.userRecipes).byId);
          set({ plans: upsertPlan(s.plans, res.plan) });
          return { ok: true, message: res.warning ?? "Meal moved", notes: res.warning ? [res.warning] : [] };
        },

        setServings(weekStart, mealId, servings) {
          withPlan(weekStart, (p) => setServingsFn(p, mealId, servings));
        },

        toggleLock(weekStart, mealId) {
          withPlan(weekStart, (p) => ({ ...p, meals: p.meals.map((m) => (m.id === mealId ? { ...m, locked: !m.locked } : m)) }));
        },

        setCooked(weekStart, mealId, cooked, deduct = true) {
          const s = get();
          const plan = findPlan(s.plans, weekStart);
          const meal = plan?.meals.find((m) => m.id === mealId);
          if (!plan || !meal) return { ok: false };
          let inventory = s.inventory;
          let message = cooked ? "Marked as cooked" : "Marked as not cooked";
          if (cooked && deduct && meal.kind === "cook") {
            const r = allRecipes(s.userRecipes).byId[meal.recipeId];
            if (r) {
              const res = deductInventory(s.inventory, applySubstitutions(r, meal.substitutions), meal.servings);
              inventory = res.inventory;
              if (res.used.length) message = `Cooked! Updated My Food: ${res.used.slice(0, 4).join(", ")}${res.used.length > 4 ? "…" : ""}`;
            }
          }
          set({
            inventory,
            plans: upsertPlan(s.plans, { ...plan, meals: plan.meals.map((m) => (m.id === mealId ? { ...m, cooked } : m)) }),
          });
          return { ok: true, message };
        },

        addLeftover(weekStart, mealId, date, slot) {
          const s = get();
          const plan = findPlan(s.plans, weekStart);
          if (!plan) return { ok: false };
          const res = addLeftoverFn(plan, mealId, date, slot, s.household, allRecipes(s.userRecipes).byId);
          if (res.error) return { ok: false, message: res.error };
          set({ plans: upsertPlan(s.plans, res.plan) });
          return { ok: true, message: "Leftovers planned – cooking extra portions" };
        },

        setSubstitution(weekStart, mealId, ingredientId, altIndex) {
          withPlan(weekStart, (p) => ({
            ...p,
            meals: p.meals.map((m) => {
              if (m.id !== mealId) return m;
              const subs = { ...(m.substitutions ?? {}) };
              if (altIndex === null) delete subs[ingredientId];
              else subs[ingredientId] = altIndex;
              return { ...m, substitutions: subs };
            }),
          }));
        },

        copyWeek(fromWeek, toWeek) {
          const s = get();
          const src = findPlan(s.plans, fromWeek);
          if (!src || !src.meals.length) return { ok: false, message: "That week has no meals to copy" };
          const target = findPlan(s.plans, toWeek);
          if (target?.meals.some((m) => m.locked || m.cooked)) {
            return { ok: false, message: "This week has locked or cooked meals – clear them first" };
          }
          const copy = copyPlanToWeek(src, toWeek);
          set({ plans: upsertPlan(s.plans, copy) });
          return { ok: true, message: `Copied ${copy.meals.length} meals` };
        },

        clearWeek(weekStart) {
          withPlan(weekStart, (p) => ({ ...p, meals: p.meals.filter((m) => m.locked || m.cooked) }));
        },

        fitBudget(weekStart) {
          const s = get();
          const plan = findPlan(s.plans, weekStart);
          if (!plan) return { ok: false, message: "No plan yet" };
          const res = fitToBudget(plannerContext(s), plan, s.household.weeklyBudgetPence);
          set({ plans: upsertPlan(s.plans, res.plan) });
          if (!res.swaps.length) {
            return {
              ok: res.after <= s.household.weeklyBudgetPence,
              message: res.after <= s.household.weeklyBudgetPence ? "Already within budget" : "No cheaper swaps found – try unlocking meals or adding leftovers",
              swaps: [],
            };
          }
          return { ok: true, message: `Made ${res.swaps.length} swap${res.swaps.length === 1 ? "" : "s"}`, swaps: res.swaps };
        },

        addInventory(item) {
          const parsed = InventoryItemSchema.parse({ ...item, id: newId("inv"), addedAt: new Date().toISOString() });
          set({ inventory: [parsed, ...get().inventory] });
        },
        updateInventory(id, patch) {
          set({ inventory: get().inventory.map((i) => (i.id === id ? InventoryItemSchema.parse({ ...i, ...patch }) : i)) });
        },
        removeInventory(id) {
          set({ inventory: get().inventory.filter((i) => i.id !== id) });
        },

        toggleChecked(weekStart, key) {
          setShopping(weekStart, (sh) => ({ ...sh, checked: { ...sh.checked, [key]: !sh.checked[key] } }));
        },
        setOwned(weekStart, key, owned) {
          setShopping(weekStart, (sh) => {
            const o = { ...sh.owned };
            if (owned) o[key] = true;
            else delete o[key];
            return { ...sh, owned: o };
          });
        },
        setOverride(weekStart, key, qty) {
          setShopping(weekStart, (sh) => {
            const o = { ...sh.overrides };
            if (qty === null) delete o[key];
            else o[key] = qty;
            return { ...sh, overrides: o };
          });
        },
        addAdhoc(weekStart, item) {
          const parsed = AdhocItemSchema.parse({ ...item, id: newId("adhoc"), checked: false });
          setShopping(weekStart, (sh) => ({ ...sh, adhoc: [...sh.adhoc, parsed] }));
        },
        toggleAdhoc(weekStart, id) {
          setShopping(weekStart, (sh) => ({ ...sh, adhoc: sh.adhoc.map((a) => (a.id === id ? { ...a, checked: !a.checked } : a)) }));
        },
        removeAdhoc(weekStart, id) {
          setShopping(weekStart, (sh) => ({ ...sh, adhoc: sh.adhoc.filter((a) => a.id !== id) }));
        },
        resetShopping(weekStart) {
          setShopping(weekStart, (sh) => ({ ...sh, checked: {}, adhoc: sh.adhoc.map((a) => ({ ...a, checked: false })) }));
        },
        moveCheckedToInventory(weekStart, items) {
          if (!items.length) return { ok: false, message: "Tick some items first" };
          const now = new Date().toISOString();
          const today = todayISO();
          const added: InventoryItem[] = items.map((i) => ({
            id: newId("inv"),
            ingredientId: i.ingredientId,
            name: i.name,
            quantity: Math.round(i.quantity * 100) / 100,
            unit: i.unit,
            location: i.location,
            purchasedOn: today,
            addedAt: now,
          }));
          // Clear their ticks and overrides; they are now "at home" and the list recalculates.
          setShopping(weekStart, (sh) => {
            const checked = { ...sh.checked };
            const overrides = { ...sh.overrides };
            for (const i of items) {
              delete checked[i.key];
              delete overrides[i.key];
            }
            return { ...sh, checked, overrides };
          });
          set({ inventory: [...added, ...get().inventory] });
          return { ok: true, message: `Added ${added.length} item${added.length === 1 ? "" : "s"} to My Food` };
        },
        toggleAlwaysHave(ingredientId) {
          const h = get().household;
          const has = h.cupboardStaples.includes(ingredientId);
          set({
            household: {
              ...h,
              assumeStaples: true,
              cupboardStaples: has ? h.cupboardStaples.filter((x) => x !== ingredientId) : [...h.cupboardStaples, ingredientId],
            },
          });
        },

        saveRecipe(recipe) {
          const parsed = RecipeSchema.parse(recipe);
          const list = get().userRecipes;
          const exists = list.some((r) => r.id === parsed.id);
          set({ userRecipes: exists ? list.map((r) => (r.id === parsed.id ? parsed : r)) : [...list, parsed] });
        },
        deleteRecipe(id) {
          const s = get();
          const inUse = s.plans.some((p) => p.meals.some((m) => m.recipeId === id && !m.cooked));
          set({
            userRecipes: s.userRecipes.filter((r) => r.id !== id),
            favouriteRecipeIds: s.favouriteRecipeIds.filter((f) => f !== id),
            plans: inUse ? s.plans.map((p) => ({ ...p, meals: p.meals.filter((m) => m.recipeId !== id || m.cooked) })) : s.plans,
          });
        },
        toggleFavourite(id) {
          const f = get().favouriteRecipeIds;
          set({ favouriteRecipeIds: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] });
        },

        addManualProduct(p) {
          const product = ProductSchema.parse({
            ...p,
            id: newId("price"),
            source: "manual",
            confidence: "high",
            lastChecked: p.lastChecked ?? todayISO(),
          });
          set({ manualProducts: [...get().manualProducts, product] });
        },
        removeManualProduct(id) {
          set({ manualProducts: get().manualProducts.filter((p) => p.id !== id) });
        },

        exportData() {
          const s = get();
          const data: AppData & { version: number; exportedAt: string; app: string } = {
            app: "uk-smart-meal-planner",
            version: STATE_VERSION,
            exportedAt: new Date().toISOString(),
            onboarded: s.onboarded,
            household: s.household,
            userRecipes: s.userRecipes,
            favouriteRecipeIds: s.favouriteRecipeIds,
            plans: s.plans,
            inventory: s.inventory,
            shopping: s.shopping,
            manualProducts: s.manualProducts,
            seed: s.seed,
          };
          return JSON.stringify(data, null, 2);
        },
        importData(json) {
          try {
            const raw = JSON.parse(json);
            const looksLikeBackup =
              raw && typeof raw === "object" && typeof raw.household === "object" && raw.household !== null && Array.isArray(raw.plans);
            if (!looksLikeBackup) return { ok: false, message: "That file isn't a valid backup" };
            const parsed = AppDataSchema.parse(migrateData(raw));
            set({ ...parsed });
            return { ok: true, message: "Backup restored" };
          } catch (e) {
            return { ok: false, message: e instanceof z.ZodError ? "That file isn't a valid backup" : "Couldn't read that file" };
          }
        },
        resetAll() {
          set({ ...initialData() });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: STATE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): AppData => ({
        onboarded: s.onboarded,
        household: s.household,
        userRecipes: s.userRecipes,
        favouriteRecipeIds: s.favouriteRecipeIds,
        plans: s.plans,
        inventory: s.inventory,
        shopping: s.shopping,
        manualProducts: s.manualProducts,
        seed: s.seed,
      }),
      migrate: (persisted) => migrateData(persisted) as AppData,
      merge: (persisted, current) => {
        const result = AppDataSchema.safeParse(migrateData(persisted));
        if (!result.success) {
          console.warn("Stored data failed validation; starting fresh.", result.error);
          return current;
        }
        return { ...current, ...result.data };
      },
    },
  ),
);

/** Fills in fields added after a user's data was saved. */
export function migrateData(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const d = raw as Record<string, unknown>;
  const definedOnly = (o: unknown) =>
    o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) : {};
  const household = { ...DEFAULT_HOUSEHOLD, ...definedOnly(d.household) } as Household;
  household.weights = { ...DEFAULT_HOUSEHOLD.weights, ...(household.weights ?? {}) };
  household.priorities = { ...DEFAULT_HOUSEHOLD.priorities, ...(household.priorities ?? {}) };
  return {
    ...initialData(),
    ...d,
    household,
  };
}

export function currentWeekStart(): string {
  return weekStartOf(todayISO());
}
