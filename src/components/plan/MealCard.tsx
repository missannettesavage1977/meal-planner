"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, Clock, Lock, LockOpen, MoreHorizontal, RefreshCw, Repeat2, Snowflake } from "lucide-react";
import type { PlannedMeal, Recipe } from "@/lib/domain/types";
import type { MealCost } from "@/lib/engine/budget";
import { analyseRecipe } from "@/lib/engine/recipeMeta";
import { formatPence } from "@/lib/utils/money";
import { formatDayShort } from "@/lib/utils/dates";
import { RecipeThumb } from "../shared";
import { Badge, IconButton, cx } from "../ui";

export function MealCard({
  meal,
  recipe,
  cost,
  source,
  onSwap,
  onRegenerate,
  onMore,
  onToggleLock,
  onToggleCooked,
}: {
  meal: PlannedMeal;
  recipe: Recipe;
  cost?: MealCost;
  source?: PlannedMeal;
  onSwap: () => void;
  onRegenerate: () => void;
  onMore: () => void;
  onToggleLock: () => void;
  onToggleCooked: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const a = analyseRecipe(recipe);
  const leftover = meal.kind === "leftover";
  const feeds = !leftover && meal.reasons?.[0]?.startsWith("Cook a double batch");
  return (
    <article
      className={cx(
        "rounded-2xl border bg-surface p-3 transition-colors",
        meal.cooked ? "border-border opacity-70" : meal.locked ? "border-primary/50" : "border-border",
      )}
      aria-label={`${meal.slot}: ${recipe.name}`}
    >
      <div className="flex gap-3">
        <Link href={`/recipes/${recipe.id}?servings=${meal.servings}`} className="shrink-0" tabIndex={-1} aria-hidden>
          <RecipeThumb recipe={recipe} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{meal.slot}</span>
            {leftover && (
              <Badge tone="info">
                <Repeat2 size={12} aria-hidden /> Leftovers{source ? ` from ${formatDayShort(source.date)}` : ""}
              </Badge>
            )}
            {feeds && <Badge tone="green">Double batch</Badge>}
            {meal.locked && (
              <Badge tone="green">
                <Lock size={12} aria-hidden /> Locked
              </Badge>
            )}
            {meal.cooked && (
              <Badge tone="neutral">
                <Check size={12} aria-hidden /> Cooked
              </Badge>
            )}
            {meal.substitutions && Object.keys(meal.substitutions).length > 0 && <Badge tone="orange">Swapped ingredient</Badge>}
          </div>
          <Link href={`/recipes/${recipe.id}?servings=${meal.servings}`} className="mt-0.5 block font-semibold leading-snug hover:underline">
            {recipe.name}
          </Link>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
            {leftover ? (
              <span>Reheat · no cooking</span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden /> {recipe.prepMins} prep + {recipe.cookMins} cook
              </span>
            )}
            <span>{meal.servings} portion{meal.servings === 1 ? "" : "s"}</span>
            {cost && !leftover && (
              <span title="Estimated value of the food this meal uses">
                ~{formatPence(cost.consumptionPence)} · {formatPence(cost.perPortionPence)}/portion
              </span>
            )}
            {cost && leftover && <span>already bought (~{formatPence(cost.perPortionPence)}/portion)</span>}
            {recipe.freezable && !leftover && (
              <span className="inline-flex items-center gap-1">
                <Snowflake size={13} aria-hidden /> freezes
              </span>
            )}
          </p>
          {meal.reasons && meal.reasons.length > 0 && (
            <button type="button" onClick={() => setShowWhy(!showWhy)} className="mt-1 inline-flex min-h-8 items-center gap-1 text-left text-sm font-medium text-primary-strong" aria-expanded={showWhy}>
              {meal.reasons[0]}
              {meal.reasons.length > 1 && <ChevronDown size={14} className={cx("transition-transform", showWhy && "rotate-180")} aria-hidden />}
            </button>
          )}
          {showWhy && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
              {meal.reasons!.slice(1).map((r) => (
                <li key={r}>{r}</li>
              ))}
              {meal.score !== undefined && <li>Match score {meal.score}%</li>}
              {a.unverified.length > 0 && <li>Some ingredients couldn&apos;t be checked for allergens</li>}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 border-t border-border pt-2">
        <IconButton label={meal.cooked ? "Mark as not cooked" : "Mark as cooked"} onClick={onToggleCooked} className={meal.cooked ? "text-primary" : ""}>
          <Check size={20} />
        </IconButton>
        <IconButton label={meal.locked ? "Unlock meal" : "Lock meal (keep when regenerating)"} onClick={onToggleLock} className={meal.locked ? "text-primary" : ""}>
          {meal.locked ? <Lock size={19} /> : <LockOpen size={19} />}
        </IconButton>
        <IconButton label="Suggest a different meal" onClick={onRegenerate} disabled={meal.locked || meal.cooked} className="disabled:opacity-30">
          <RefreshCw size={19} />
        </IconButton>
        <button
          type="button"
          onClick={onSwap}
          disabled={meal.cooked}
          className="min-h-10 rounded-full border border-border px-3.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
        >
          Swap
        </button>
        <IconButton label="More options" onClick={onMore}>
          <MoreHorizontal size={20} />
        </IconButton>
      </div>
    </article>
  );
}
