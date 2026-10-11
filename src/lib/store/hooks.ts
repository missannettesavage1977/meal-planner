"use client";

import { useMemo, useSyncExternalStore } from "react";
import { computeBudget, shoppingLinesFor, type BudgetSummary } from "../engine/budget";
import type { ShoppingLine } from "../engine/consolidate";
import type { MealPlan, ShoppingState } from "../domain/types";
import { addDays, daysBetween, todayISO, weekStartOf } from "../utils/dates";
import { allRecipes, findPlan, priceBookFor, useAppStore } from "./appStore";

/** True once persisted state has been loaded from localStorage. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
}

const subscribeNoop = () => () => {};
/** Today's ISO date, computed on the client only. */
export function useToday(): string {
  return useSyncExternalStore(subscribeNoop, () => todayISO(), () => "2000-01-01");
}

export function useCurrentWeekStart(): string {
  const today = useToday();
  return weekStartOf(today);
}

/**
 * The week the user is most likely working on: this week, unless it's nearly over
 * (or nothing is left to cook) and next week already has a plan.
 */
export function useActiveWeekStart(): string {
  const thisWeek = useCurrentWeekStart();
  const today = useToday();
  const plans = useAppStore((s) => s.plans);
  const thisPlan = plans.find((p) => p.weekStart === thisWeek);
  const nextPlan = plans.find((p) => p.weekStart === addDays(thisWeek, 7));
  const nearWeekEnd = daysBetween(today, addDays(thisWeek, 6)) < 2;
  const thisWeekDone = nearWeekEnd || !thisPlan?.meals.some((m) => m.date >= today && !m.cooked);
  return thisWeekDone && nextPlan?.meals.length ? nextPlan.weekStart : thisWeek;
}

export function useRecipes() {
  const userRecipes = useAppStore((s) => s.userRecipes);
  return useMemo(() => allRecipes(userRecipes), [userRecipes]);
}

export function usePriceBook() {
  const manual = useAppStore((s) => s.manualProducts);
  return useMemo(() => priceBookFor(manual), [manual]);
}

const EMPTY: ShoppingState = { checked: {}, owned: {}, overrides: {}, adhoc: [] };

export function usePlan(weekStart: string): MealPlan | undefined {
  const plans = useAppStore((s) => s.plans);
  return useMemo(() => findPlan(plans, weekStart), [plans, weekStart]);
}

export function useShopping(weekStart: string): ShoppingState {
  return useAppStore((s) => s.shopping[weekStart]) ?? EMPTY;
}

export function useWeekData(weekStart: string): { plan?: MealPlan; lines: ShoppingLine[]; budget: BudgetSummary; shopping: ShoppingState } {
  const plan = usePlan(weekStart);
  const household = useAppStore((s) => s.household);
  const inventory = useAppStore((s) => s.inventory);
  const shopping = useShopping(weekStart);
  const { byId } = useRecipes();
  const priceBook = usePriceBook();
  return useMemo(() => {
    const p = plan ?? { meals: [] };
    const input = { plan: p, recipes: byId, household, inventory, priceBook, shopping };
    const lines = shoppingLinesFor(input);
    const budget = computeBudget({ ...input, lines, adhoc: shopping.adhoc });
    return { plan, lines, budget, shopping };
  }, [plan, household, inventory, shopping, byId, priceBook]);
}
