import { beforeEach, describe, expect, it } from "vitest";

// Minimal in-memory localStorage so the persisted store behaves as in a browser.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

const { useAppStore, initialData, migrateData, AppDataSchema, STORAGE_KEY, currentWeekStart } = await import("@/lib/store/appStore");
const { addDays } = await import("@/lib/utils/dates");
const { DEFAULT_HOUSEHOLD } = await import("@/lib/domain/types");

const NEXT_WEEK = addDays(currentWeekStart(), 7);

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ ...initialData() });
});

describe("app store", () => {
  it("persists the plan, inventory and ticks to storage", () => {
    const s = useAppStore.getState();
    s.completeOnboarding({ ...DEFAULT_HOUSEHOLD, supermarket: "asda" });
    expect(s.generateWeek(NEXT_WEEK).ok).toBe(true);
    s.addInventory({ ingredientId: "rice", name: "rice", quantity: 500, unit: "g", location: "cupboard" });
    s.toggleChecked(NEXT_WEEK, "onion");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.household.supermarket).toBe("asda");
    expect(saved.state.plans[0].meals.length).toBe(7);
    expect(saved.state.inventory[0].name).toBe("rice");
    expect(saved.state.shopping[NEXT_WEEK].checked.onion).toBe(true);
    expect(AppDataSchema.safeParse(saved.state).success).toBe(true);
  });

  it("swapping one meal leaves the rest of the week alone", () => {
    const s = useAppStore.getState();
    s.completeOnboarding({ ...DEFAULT_HOUSEHOLD, leftoversPerWeek: 0 });
    s.generateWeek(NEXT_WEEK);
    const before = useAppStore.getState().plans[0].meals;
    const res = useAppStore.getState().regenerateMeal(NEXT_WEEK, before[2].id);
    expect(res.ok).toBe(true);
    const after = useAppStore.getState().plans[0].meals;
    expect(after).toHaveLength(before.length);
    expect(after.find((m) => m.id === before[2].id)!.recipeId).not.toBe(before[2].recipeId);
    for (const m of before.filter((x) => x.id !== before[2].id)) expect(after.find((x) => x.id === m.id)).toEqual(m);
  });

  it("marking a meal cooked uses up matching food in My Food", () => {
    const s = useAppStore.getState();
    s.completeOnboarding(DEFAULT_HOUSEHOLD);
    s.addMeal(NEXT_WEEK, NEXT_WEEK, "dinner", "red-lentil-dhal"); // 250 g lentils for 4 → 125 g for 2
    s.addInventory({ ingredientId: null, name: "red lentils", quantity: 500, unit: "g", location: "cupboard" });
    const meal = useAppStore.getState().plans[0].meals[0];
    useAppStore.getState().setCooked(NEXT_WEEK, meal.id, true);
    expect(useAppStore.getState().inventory[0].quantity).toBe(375);
  });

  it("round-trips a backup and rejects invalid files", () => {
    const s = useAppStore.getState();
    s.completeOnboarding(DEFAULT_HOUSEHOLD);
    s.generateWeek(NEXT_WEEK);
    const json = s.exportData();
    useAppStore.getState().resetAll();
    expect(useAppStore.getState().plans).toHaveLength(0);
    expect(useAppStore.getState().importData(json).ok).toBe(true);
    expect(useAppStore.getState().plans[0].meals.length).toBe(7);
    expect(useAppStore.getState().importData("{\"household\": 5}").ok).toBe(false);
    expect(useAppStore.getState().importData("not json").ok).toBe(false);
    expect(useAppStore.getState().plans[0].meals.length).toBe(7); // unchanged after bad import
  });

  it("migrates older saved data by filling in new settings", () => {
    const old = { ...initialData(), household: { ...DEFAULT_HOUSEHOLD, cupboardStaples: undefined, weights: { cost: 4 } } };
    const migrated = AppDataSchema.parse(migrateData(old));
    expect(migrated.household.cupboardStaples).toBeDefined();
    expect(migrated.household.weights.cost).toBe(4);
    expect(migrated.household.weights.variety).toBe(DEFAULT_HOUSEHOLD.weights.variety);
  });
});
