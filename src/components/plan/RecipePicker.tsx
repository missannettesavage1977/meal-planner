"use client";

import { useMemo, useState } from "react";
import { Clock, Search } from "lucide-react";
import type { MealSlot, PlannedMeal } from "@/lib/domain/types";
import { rankCandidates, type ScoredCandidate } from "@/lib/engine/planner";
import { analyseRecipe } from "@/lib/engine/recipeMeta";
import { plannerContext, useAppStore } from "@/lib/store/appStore";
import { formatPence } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { RecipeThumb } from "../shared";
import { Badge, Sheet, inputClass } from "../ui";

/**
 * Lists recipes that suit the household for a slot, ranked by the planner with
 * its reasons. Used both for swapping a meal and filling an empty slot.
 */
export function RecipePicker({
  open,
  onClose,
  date,
  slot,
  meals,
  excludeMealId,
  currentRecipeId,
  onPick,
  title,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  slot: MealSlot;
  meals: PlannedMeal[];
  excludeMealId?: string;
  currentRecipeId?: string;
  onPick: (recipeId: string) => void;
  title: string;
}) {
  const [q, setQ] = useState("");
  const [showAllSlots, setShowAllSlots] = useState(false);
  const state = useAppStore();
  const ranked = useMemo<ScoredCandidate[]>(() => {
    if (!open) return [];
    const ctx = plannerContext(state);
    const others = meals.filter((m) => m.id !== excludeMealId && m.leftoverOf !== excludeMealId);
    const forSlot = rankCandidates(ctx, others, date, slot, { exclude: currentRecipeId ? [currentRecipeId] : [] });
    if (!showAllSlots) return forSlot;
    const extra = (["breakfast", "lunch", "dinner"] as MealSlot[])
      .filter((s) => s !== slot)
      .flatMap((s) => rankCandidates(ctx, others, date, s, { exclude: currentRecipeId ? [currentRecipeId] : [] }));
    const seen = new Set(forSlot.map((c) => c.recipe.id));
    return [...forSlot, ...extra.filter((c) => !seen.has(c.recipe.id) && seen.add(c.recipe.id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, slot, excludeMealId, currentRecipeId, showAllSlots, state.household, state.inventory, state.userRecipes, state.manualProducts, meals]);

  const inPlan = new Set(meals.filter((m) => m.id !== excludeMealId).map((m) => m.recipeId));
  const query = q.trim().toLowerCase();
  const filtered = ranked.filter((c) => {
    if (!query) return true;
    const hay = `${c.recipe.name} ${c.recipe.cuisine} ${c.recipe.tags.join(" ")} ${c.recipe.ingredients.map((i) => i.name).join(" ")}`.toLowerCase();
    return query.split(/\s+/).every((w) => hay.includes(w));
  });

  return (
    <Sheet open={open} onClose={onClose} title={title} wide>
      <p className="mb-3 text-sm text-muted">
        {formatDate(date)} · {slot}. Ranked for your household – only recipes that pass your allergy and diet filters are shown.
      </p>
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input className={`${inputClass} pl-10`} placeholder="Search recipes or ingredients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
      </div>
      <label className="mb-3 flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={showAllSlots} onChange={(e) => setShowAllSlots(e.target.checked)} />
        Include recipes for other meal types
      </label>
      {filtered.length === 0 && <p className="py-6 text-center text-muted">No suitable recipes match. Try another search.</p>}
      <ul className="space-y-2">
        {filtered.slice(0, 40).map((c) => {
          const a = analyseRecipe(c.recipe);
          return (
            <li key={c.recipe.id}>
              <button
                type="button"
                onClick={() => onPick(c.recipe.id)}
                className="flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-3 text-left hover:border-primary"
              >
                <RecipeThumb recipe={c.recipe} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.recipe.name}</span>
                    {inPlan.has(c.recipe.id) && <Badge tone="warn">Already this week</Badge>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} aria-hidden /> {a.totalMins} min
                    </span>
                    <span>~{formatPence(c.consumptionPence / c.portions)}/portion</span>
                    <span>+{formatPence(c.marginalCostPence)} to shop</span>
                  </span>
                  {c.reasons[0] && <span className="mt-1 block text-sm text-primary-strong">{c.reasons.slice(0, 2).join(" · ")}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-1 text-xs font-bold text-primary-strong" title="Match score">
                  {Math.round(c.score * 100)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
