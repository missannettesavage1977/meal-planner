"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { getIngredient } from "@/lib/data/ingredients";
import type { MealSlot, PlannedMeal, Recipe } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/appStore";
import { DAY_LONG, formatDate, weekDates } from "@/lib/utils/dates";
import { toastResult } from "../toast";
import { Button, Field, Sheet, Stepper, inputClass } from "../ui";

export function MealOptionsSheet({
  open,
  onClose,
  weekStart,
  meal,
  recipe,
}: {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  meal: PlannedMeal;
  recipe: Recipe;
}) {
  const household = useAppStore((s) => s.household);
  const setServings = useAppStore((s) => s.setServings);
  const moveMeal = useAppStore((s) => s.moveMeal);
  const addLeftover = useAppStore((s) => s.addLeftover);
  const removeMeal = useAppStore((s) => s.removeMeal);
  const setSubstitution = useAppStore((s) => s.setSubstitution);
  const dates = weekDates(weekStart);
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
  const [moveDate, setMoveDate] = useState(meal.date);
  const [moveSlot, setMoveSlot] = useState<MealSlot>(meal.slot);
  const later = dates.filter((d) => d > meal.date && d <= dates[6]);
  const [leftDate, setLeftDate] = useState(later[0] ?? "");
  const [leftSlot, setLeftSlot] = useState<MealSlot>("dinner");

  return (
    <Sheet open={open} onClose={onClose} title={recipe.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Portions</p>
            <p className="text-sm text-muted">{meal.kind === "cook" ? "Includes any planned leftovers" : "Portions eaten as leftovers"}</p>
          </div>
          <Stepper label="portions" value={meal.servings} min={0.5} max={48} step={meal.servings < 2 ? 0.5 : 1} onChange={(v) => setServings(weekStart, meal.id, v)} />
        </div>

        <Link href={`/recipes/${recipe.id}?servings=${meal.servings}`} className="flex min-h-12 items-center gap-2 rounded-xl bg-surface-2 px-4 font-semibold">
          <BookOpen size={18} aria-hidden /> View recipe & method
        </Link>

        <fieldset className="space-y-2">
          <legend className="font-semibold">Move to another day</legend>
          <div className="grid grid-cols-2 gap-2">
            <select className={inputClass} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} aria-label="Day">
              {dates.map((d, i) => (
                <option key={d} value={d}>
                  {DAY_LONG[i]} {formatDate(d, { day: "numeric", month: "short" })}
                </option>
              ))}
            </select>
            <select className={inputClass} value={moveSlot} onChange={(e) => setMoveSlot(e.target.value as MealSlot)} aria-label="Meal">
              {slots.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            disabled={moveDate === meal.date && moveSlot === meal.slot}
            onClick={() => {
              toastResult(moveMeal(weekStart, meal.id, moveDate, moveSlot));
              onClose();
            }}
          >
            Move (swaps if that slot is taken)
          </Button>
        </fieldset>

        {meal.kind === "cook" && (
          <fieldset className="space-y-2">
            <legend className="font-semibold">Cook extra for leftovers</legend>
            {recipe.keepsDays > 0 ? (
              <>
                <p className="text-sm text-muted">
                  Keeps {recipe.keepsDays} day{recipe.keepsDays === 1 ? "" : "s"} in the fridge{recipe.freezable ? " and freezes well" : ""}. Adds{" "}
                  {household.portionsPerMeal} portions to this meal.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select className={inputClass} value={leftDate} onChange={(e) => setLeftDate(e.target.value)} aria-label="Leftovers day">
                    {[meal.date, ...later].map((d) => (
                      <option key={d} value={d}>
                        {DAY_LONG[dates.indexOf(d)]}
                      </option>
                    ))}
                  </select>
                  <select className={inputClass} value={leftSlot} onChange={(e) => setLeftSlot(e.target.value as MealSlot)} aria-label="Leftovers meal">
                    {slots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!leftDate}
                  onClick={() => {
                    const r = addLeftover(weekStart, meal.id, leftDate, leftSlot);
                    toastResult(r);
                    if (r.ok) onClose();
                  }}
                >
                  Plan leftovers
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted">This dish is best eaten fresh, so we don&apos;t suggest keeping leftovers.</p>
            )}
          </fieldset>
        )}

        {meal.kind === "cook" && recipe.substitutions.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="font-semibold">Ingredient swaps</legend>
            <p className="text-sm text-muted">Changes the shopping list for this meal only.</p>
            {recipe.substitutions.map((s) => {
              const ing = getIngredient(s.ingredientId);
              const chosen = meal.substitutions?.[s.ingredientId];
              return (
                <Field key={s.ingredientId} label={`Instead of ${ing?.name ?? s.ingredientId}`}>
                  <select
                    className={inputClass}
                    value={chosen ?? -1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setSubstitution(weekStart, meal.id, s.ingredientId, v < 0 ? null : v);
                    }}
                  >
                    <option value={-1}>Keep {ing?.name}</option>
                    {s.alternatives.map((alt, i) => (
                      <option key={i} value={i}>
                        {alt.name}
                      </option>
                    ))}
                  </select>
                  {chosen !== undefined && s.alternatives[chosen]?.note && <p className="text-sm text-muted">{s.alternatives[chosen].note}</p>}
                </Field>
              );
            })}
            <p className="text-xs text-muted">Swaps can change allergens – check the new ingredient&apos;s label.</p>
          </fieldset>
        )}

        <Button
          variant="danger"
          className="w-full"
          icon={<Trash2 size={18} />}
          onClick={() => {
            removeMeal(weekStart, meal.id);
            onClose();
            toastResult({ ok: true, message: "Meal removed", notes: meal.kind === "cook" ? undefined : ["The original meal now cooks fewer portions."] });
          }}
        >
          Remove from plan
        </Button>
      </div>
    </Sheet>
  );
}
