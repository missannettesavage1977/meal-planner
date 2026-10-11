"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck2, ChevronLeft, ChevronRight, CopyPlus, Eraser, PiggyBank, Plus, Sparkles, Wand2 } from "lucide-react";
import { Hydrated } from "@/components/Hydrated";
import { MealCard } from "@/components/plan/MealCard";
import { MealOptionsSheet } from "@/components/plan/MealOptionsSheet";
import { RecipePicker } from "@/components/plan/RecipePicker";
import { WeekRequestBox } from "@/components/plan/WeekRequestBox";
import { BudgetBar, PriceDisclaimer } from "@/components/shared";
import { toastResult } from "@/components/toast";
import { Button, Card, Chip, EmptyState, PageHeader, Sheet } from "@/components/ui";
import type { MealSlot, PlannedMeal } from "@/lib/domain/types";
import type { BudgetSwap } from "@/lib/engine/planner";
import { useAppStore } from "@/lib/store/appStore";
import { useActiveWeekStart, useCurrentWeekStart, useRecipes, useToday, useWeekData } from "@/lib/store/hooks";
import { addDays, DAY_LONG, dayIndex, formatDate, weekDates } from "@/lib/utils/dates";
import { formatPence } from "@/lib/utils/money";

export default function PlanPage() {
  return (
    <Hydrated>
      <Suspense>
        <PlanView />
      </Suspense>
    </Hydrated>
  );
}

function weekLabel(weekStart: string, current: string) {
  const end = addDays(weekStart, 6);
  const range = `${formatDate(weekStart, { day: "numeric", month: "short" })} – ${formatDate(end, { day: "numeric", month: "short" })}`;
  if (weekStart === current) return { title: "This week", range };
  if (weekStart === addDays(current, 7)) return { title: "Next week", range };
  if (weekStart === addDays(current, -7)) return { title: "Last week", range };
  return { title: `Week of ${formatDate(weekStart, { day: "numeric", month: "short" })}`, range };
}

function PlanView() {
  const current = useCurrentWeekStart();
  const today = useToday();
  const params = useSearchParams();
  const active = useActiveWeekStart();
  const [weekStart, setWeekStart] = useState(params.get("week") === "next" ? addDays(current, 7) : active);
  const { plan, budget } = useWeekData(weekStart);
  const { byId } = useRecipes();
  const household = useAppStore((s) => s.household);
  const plans = useAppStore((s) => s.plans);
  const generateWeek = useAppStore((s) => s.generateWeek);
  const toggleLock = useAppStore((s) => s.toggleLock);
  const setCooked = useAppStore((s) => s.setCooked);
  const regenerateMeal = useAppStore((s) => s.regenerateMeal);
  const replaceMeal = useAppStore((s) => s.replaceMeal);
  const addMeal = useAppStore((s) => s.addMeal);
  const fitBudget = useAppStore((s) => s.fitBudget);
  const copyWeek = useAppStore((s) => s.copyWeek);
  const clearWeek = useAppStore((s) => s.clearWeek);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [picker, setPicker] = useState<{ date: string; slot: MealSlot; meal?: PlannedMeal } | null>(null);
  const [options, setOptions] = useState<PlannedMeal | null>(null);
  const [swaps, setSwaps] = useState<{ swaps: BudgetSwap[]; message: string } | null>(null);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const meals = useMemo(() => plan?.meals ?? [], [plan]);
  const dates = weekDates(weekStart);
  const label = weekLabel(weekStart, current);
  const costByMeal = new Map(budget.mealCosts.map((c) => [c.meal.id, c]));
  const unlockedCount = meals.filter((m) => !m.locked && !m.cooked).length;
  const pastWeeks = plans.filter((p) => p.weekStart !== weekStart && p.meals.length > 0).sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const run = (fn: () => void) => {
    setBusy(true);
    // let the button show its busy state before the (synchronous) planner runs
    setTimeout(() => {
      fn();
      setBusy(false);
    }, 10);
  };

  const generate = (dates?: string[]) =>
    run(() => {
      const r = generateWeek(weekStart, dates);
      toastResult(r);
      setSelecting(false);
      setSelected([]);
    });

  const pickerMeal = picker?.meal;

  return (
    <div>
      <PageHeader
        title="Meal plan"
        subtitle={
          <span className="inline-flex items-center gap-1">
            {label.title} · {label.range}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} icon={<ChevronLeft size={18} />}>
              <span className="sr-only sm:not-sr-only">Prev</span>
            </Button>
            {weekStart !== current && (
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(current)}>
                Today
              </Button>
            )}
            <Button variant="secondary" size="sm" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <span className="sr-only sm:not-sr-only">Next</span>
              <ChevronRight size={18} aria-hidden />
            </Button>
          </div>
        }
      />

      {/* Summary */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Estimated shop for this plan</p>
            <p className="text-2xl font-bold">
              ~{formatPence(budget.shopping.pence)}{" "}
              <span className="text-base font-medium text-muted">of {formatPence(budget.budgetPence)} budget</span>
            </p>
          </div>
          <div className="text-right text-sm text-muted">
            <p>
              {meals.filter((m) => m.kind === "cook").length} to cook · {meals.filter((m) => m.kind === "leftover").length} leftover
            </p>
            {budget.portions > 0 && <p>~{formatPence(budget.costPerPortionPence)} per portion</p>}
          </div>
        </div>
        <div className="mt-3">
          <BudgetBar spend={budget.spendPence} budget={budget.budgetPence} />
        </div>
        {budget.remainingPence < 0 && meals.length > 0 && (
          <p className="mt-2 text-sm font-medium text-danger">About {formatPence(-budget.remainingPence)} over budget – try “Fit to budget”.</p>
        )}
      </Card>

      {/* Actions */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Button icon={<Sparkles size={18} />} disabled={busy} onClick={() => generate()}>
          {busy ? "Planning…" : meals.length ? (unlockedCount < meals.length ? "Regenerate unlocked" : "Regenerate week") : "Generate my week"}
        </Button>
        <Button variant="secondary" icon={<CalendarCheck2 size={18} />} onClick={() => setSelecting(!selecting)} aria-pressed={selecting}>
          Choose days
        </Button>
        <Button
          variant="secondary"
          icon={<PiggyBank size={18} />}
          disabled={!meals.length || busy}
          onClick={() =>
            run(() => {
              const r = fitBudget(weekStart);
              if (r.swaps?.length) setSwaps({ swaps: r.swaps, message: r.message ?? "" });
              else toastResult(r);
            })
          }
        >
          Fit to budget
        </Button>
        <Button variant="ghost" icon={<CopyPlus size={18} />} onClick={() => setReuseOpen(true)} disabled={!pastWeeks.length}>
          Reuse a week
        </Button>
        {meals.length > 0 && (
          <Button
            variant="ghost"
            icon={<Eraser size={18} />}
            onClick={() => {
              if (confirm("Clear all unlocked meals from this week?")) clearWeek(weekStart);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {!selecting && (
        <WeekRequestBox
          busy={busy}
          onPlan={(request, summary) =>
            run(() => {
              const r = generateWeek(weekStart, undefined, request);
              toastResult({ ...r, notes: [...summary, ...(r.notes ?? [])] });
            })
          }
        />
      )}

      {selecting && (
        <Card className="mb-5">
          <p className="mb-2 font-semibold">Plan only these days</p>
          <p className="mb-3 text-sm text-muted">Locked meals stay put; other days are left exactly as they are.</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {dates.map((d, i) => (
              <Chip key={d} selected={selected.includes(d)} onClick={() => setSelected(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d])}>
                {DAY_LONG[i].slice(0, 3)} {formatDate(d, { day: "numeric" })}
              </Chip>
            ))}
          </div>
          <Button icon={<Wand2 size={18} />} disabled={!selected.length || busy} onClick={() => generate(selected)}>
            Plan {selected.length || ""} day{selected.length === 1 ? "" : "s"}
          </Button>
        </Card>
      )}

      {!meals.length && (
        <EmptyState icon="🗓️" title="Nothing planned yet" action={<Button icon={<Sparkles size={18} />} onClick={() => generate()} disabled={busy}>Generate my week</Button>}>
          We&apos;ll pick {household.planDays.length * household.slots.length} meals that suit your household, reuse fresh
          ingredients, and use up what&apos;s in My Food first.
        </EmptyState>
      )}

      {meals.length > 0 && (
        <ol className="space-y-5">
          {dates.map((date) => {
            const dayMeals = meals.filter((m) => m.date === date);
            const planned = household.planDays.includes(dayIndex(date));
            const slots = (["breakfast", "lunch", "dinner"] as MealSlot[]).filter((s) => household.slots.includes(s) || dayMeals.some((m) => m.slot === s));
            const isToday = date === today;
            return (
              <li key={date} aria-label={DAY_LONG[dayIndex(date)]}>
                <h2 className="mb-2 flex items-baseline gap-2 text-lg font-bold">
                  {DAY_LONG[dayIndex(date)]}
                  <span className="text-sm font-medium text-muted">{formatDate(date, { day: "numeric", month: "short" })}</span>
                  {isToday && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">Today</span>}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {slots.map((slot) => {
                    const meal = dayMeals.find((m) => m.slot === slot);
                    if (meal) {
                      const recipe = byId[meal.recipeId];
                      if (!recipe) return null;
                      return (
                        <MealCard
                          key={meal.id}
                          meal={meal}
                          recipe={recipe}
                          cost={costByMeal.get(meal.id)}
                          source={meal.leftoverOf ? meals.find((m) => m.id === meal.leftoverOf) : undefined}
                          onSwap={() => setPicker({ date, slot, meal })}
                          onMore={() => setOptions(meal)}
                          onRegenerate={() => toastResult(regenerateMeal(weekStart, meal.id))}
                          onToggleLock={() => toggleLock(weekStart, meal.id)}
                          onToggleCooked={() => toastResult(setCooked(weekStart, meal.id, !meal.cooked))}
                        />
                      );
                    }
                    if (!planned && !household.slots.includes(slot)) return null;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setPicker({ date, slot })}
                        className="flex min-h-20 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-[15px] font-semibold text-muted hover:border-primary hover:text-primary"
                      >
                        <Plus size={18} aria-hidden /> Add {slot}
                        {!planned && <span className="font-normal">(day off)</span>}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {meals.length > 0 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link href="/shopping" className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-semibold text-white shadow-sm">
            View shopping list
          </Link>
          <PriceDisclaimer className="max-w-xl" />
        </div>
      )}

      {picker && (
        <RecipePicker
          open
          onClose={() => setPicker(null)}
          date={picker.date}
          slot={picker.slot}
          meals={meals}
          excludeMealId={pickerMeal?.id}
          currentRecipeId={pickerMeal?.recipeId}
          title={pickerMeal ? "Swap this meal" : `Add ${picker.slot}`}
          onPick={(recipeId) => {
            toastResult(pickerMeal ? replaceMeal(weekStart, pickerMeal.id, recipeId) : addMeal(weekStart, picker.date, picker.slot, recipeId));
            setPicker(null);
          }}
        />
      )}

      {options && byId[options.recipeId] && (
        <MealOptionsSheet
          key={options.id}
          open
          onClose={() => setOptions(null)}
          weekStart={weekStart}
          meal={meals.find((m) => m.id === options.id) ?? options}
          recipe={byId[options.recipeId]}
        />
      )}

      <Sheet open={!!swaps} onClose={() => setSwaps(null)} title="Budget swaps made" footer={<Button className="w-full" onClick={() => setSwaps(null)}>Done</Button>}>
        <p className="mb-3 text-sm text-muted">
          We swapped the meals that saved the most on your shopping bill, counting shared packs and food you already have. Locked
          and cooked meals were left alone.
        </p>
        <ul className="space-y-2">
          {swaps?.swaps.map((s) => (
            <li key={s.mealId + s.to} className="rounded-xl bg-surface-2 p-3 text-[15px]">
              <span className="font-semibold">{DAY_LONG[dayIndex(s.date)]}:</span> {s.from} → <span className="font-semibold">{s.to}</span>
              <span className="block text-sm text-primary-strong">saves about {formatPence(s.savingPence)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          New estimate: <strong>~{formatPence(budget.shopping.pence)}</strong> (budget {formatPence(budget.budgetPence)}).
        </p>
      </Sheet>

      <Sheet open={reuseOpen} onClose={() => setReuseOpen(false)} title="Reuse a previous week">
        <p className="mb-3 text-sm text-muted">Copies all meals into {label.title.toLowerCase()}, replacing anything not locked.</p>
        <ul className="space-y-2">
          {pastWeeks.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full rounded-2xl border border-border p-3 text-left hover:border-primary"
                onClick={() => {
                  toastResult(copyWeek(p.weekStart, weekStart));
                  setReuseOpen(false);
                }}
              >
                <span className="font-semibold">Week of {formatDate(p.weekStart, { day: "numeric", month: "long" })}</span>
                <span className="mt-1 block text-sm text-muted">
                  {p.meals
                    .filter((m) => m.kind === "cook")
                    .map((m) => byId[m.recipeId]?.name)
                    .filter(Boolean)
                    .slice(0, 4)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
