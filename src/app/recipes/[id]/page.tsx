"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowLeft, CalendarPlus, Clock, Heart, Pencil, Snowflake, Trash2, Users } from "lucide-react";
import { Hydrated } from "@/components/Hydrated";
import { AllergenCaveat, EstimateBadge, Money, PriceDisclaimer, RecipeThumb } from "@/components/shared";
import { toastResult } from "@/components/toast";
import { Badge, Button, Card, Chip, EmptyState, LinkButton, Notice, Sheet, Stepper, cx } from "@/components/ui";
import { getIngredient } from "@/lib/data/ingredients";
import { ALLERGEN_LABELS, CUISINE_LABELS, DIET_LABELS, type MealSlot } from "@/lib/domain/types";
import { mealConsumptionCost, standalonePurchaseCost } from "@/lib/engine/budget";
import { analyseRecipe, checkSuitability, recipeTags, resolveIngredient } from "@/lib/engine/recipeMeta";
import { formatRecipeQuantity } from "@/lib/engine/units";
import { useAppStore } from "@/lib/store/appStore";
import { useCurrentWeekStart, usePriceBook, useRecipes } from "@/lib/store/hooks";
import { addDays, DAY_LONG, formatDate, weekDates } from "@/lib/utils/dates";
import { formatPence } from "@/lib/utils/money";

export default function RecipePage() {
  return (
    <Hydrated>
      <Suspense>
        <RecipeView />
      </Suspense>
    </Hydrated>
  );
}

function RecipeView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { byId } = useRecipes();
  const recipe = byId[decodeURIComponent(id)];
  const household = useAppStore((s) => s.household);
  const favourites = useAppStore((s) => s.favouriteRecipeIds);
  const toggleFavourite = useAppStore((s) => s.toggleFavourite);
  const deleteRecipe = useAppStore((s) => s.deleteRecipe);
  const priceBook = usePriceBook();
  const initial = Number(params.get("servings")) || household.portionsPerMeal;
  const [servings, setServings] = useState(initial);
  const [adding, setAdding] = useState(false);

  const costs = useMemo(() => {
    if (!recipe) return null;
    return {
      consumption: mealConsumptionCost(recipe, servings, household, priceBook),
      purchase: standalonePurchaseCost(recipe, servings, household, priceBook),
    };
  }, [recipe, servings, household, priceBook]);

  if (!recipe || !costs) {
    return (
      <EmptyState icon="🤔" title="Recipe not found" action={<LinkButton href="/recipes">Back to recipes</LinkButton>}>
        It may have been deleted.
      </EmptyState>
    );
  }

  const a = analyseRecipe(recipe);
  const suit = checkSuitability(recipe, household);
  const factor = servings / recipe.servings;
  const fav = favourites.includes(recipe.id);
  const isUser = recipe.source !== "original";

  return (
    <article>
      <button type="button" onClick={() => router.back()} className="mb-3 inline-flex min-h-10 items-center gap-1 text-[15px] font-semibold text-muted hover:text-text">
        <ArrowLeft size={18} aria-hidden /> Back
      </button>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <RecipeThumb recipe={recipe} size="xl" className="mb-4" />
          <div className="flex flex-wrap gap-1.5">
            {recipe.cuisine !== "other" && <Badge tone="green">{CUISINE_LABELS[recipe.cuisine]}</Badge>}
            {recipeTags(recipe).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
            {isUser && <Badge tone="info">{recipe.source === "imported" ? "Imported" : "Your recipe"}</Badge>}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{recipe.name}</h1>
          {recipe.description && <p className="mt-2 text-lg text-muted">{recipe.description}</p>}
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={17} aria-hidden /> {recipe.prepMins} min prep · {recipe.cookMins >= 120 ? `${Math.round(recipe.cookMins / 60)} hr` : `${recipe.cookMins} min`} cook
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={17} aria-hidden /> Recipe serves {recipe.servings}
            </span>
            <span className="capitalize">{recipe.difficulty}</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={<CalendarPlus size={18} />} onClick={() => setAdding(true)}>
              Add to plan
            </Button>
            <Button variant="secondary" icon={<Heart size={18} className={cx(fav && "fill-accent text-accent")} />} onClick={() => toggleFavourite(recipe.id)} aria-pressed={fav}>
              {fav ? "Favourite" : "Add to favourites"}
            </Button>
            {isUser && (
              <>
                <LinkButton href={`/recipes/new?edit=${recipe.id}`} variant="secondary" icon={<Pencil size={18} />}>
                  Edit
                </LinkButton>
                <Button
                  variant="danger"
                  icon={<Trash2 size={18} />}
                  onClick={() => {
                    if (confirm(`Delete “${recipe.name}”? It will also be removed from uncooked meals in your plans.`)) {
                      deleteRecipe(recipe.id);
                      router.push("/recipes");
                    }
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>

          {!suit.ok && (
            <Notice tone="danger" title="Not suitable for your household" className="mt-4">
              <ul className="list-disc pl-5">
                {suit.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Notice>
          )}
          {suit.warnings.length > 0 && (
            <Notice tone="warn" className="mt-4">
              {suit.warnings.join(". ")}
            </Notice>
          )}

          <section className="mt-6" aria-labelledby="ingredients-h">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="ingredients-h" className="text-xl font-bold">
                Ingredients
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Portions</span>
                <Stepper label="portions" value={servings} min={1} max={24} onChange={setServings} />
              </div>
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {recipe.ingredients.map((line, i) => {
                const ing = resolveIngredient(line);
                return (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <span className="w-24 shrink-0 font-semibold tabular-nums">{line.quantity > 0 ? formatRecipeQuantity(line.quantity * factor, line.unit, ing) : "to taste"}</span>
                    <span className="min-w-0">
                      <span className={cx(line.optional && "text-muted")}>{ing?.name ?? line.name}</span>
                      {line.note && <span className="text-muted">, {line.note}</span>}
                      {line.optional && <span className="ml-1 text-xs text-muted">(optional)</span>}
                      {!ing && <span className="ml-1 text-xs text-warn">· not recognised – allergens unknown</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-6" aria-labelledby="method-h">
            <h2 id="method-h" className="mb-3 text-xl font-bold">
              Method
            </h2>
            <ol className="space-y-3">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-strong" aria-hidden>
                    {i + 1}
                  </span>
                  <p className="pt-1 text-[16px] leading-relaxed">{s}</p>
                </li>
              ))}
            </ol>
          </section>

          {(recipe.storage || recipe.keepsDays > 0 || recipe.freezable) && (
            <section className="mt-6">
              <h2 className="mb-2 text-xl font-bold">Storage & leftovers</h2>
              <p className="text-[15px] leading-relaxed">{recipe.storage}</p>
              <p className="mt-2 flex flex-wrap gap-2 text-sm">
                {recipe.keepsDays > 0 && <Badge tone="info">Keeps {recipe.keepsDays} days in the fridge</Badge>}
                {recipe.freezable && (
                  <Badge tone="info">
                    <Snowflake size={12} aria-hidden /> Freezes well
                  </Badge>
                )}
              </p>
            </section>
          )}

          {recipe.substitutions.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-xl font-bold">Swaps & substitutions</h2>
              <ul className="space-y-2 text-[15px]">
                {recipe.substitutions.map((s) => (
                  <li key={s.ingredientId}>
                    <span className="font-semibold">{getIngredient(s.ingredientId)?.name ?? s.ingredientId}:</span>{" "}
                    {s.alternatives.map((alt) => alt.name + (alt.note ? ` (${alt.note})` : "")).join("; ")}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-sm text-muted">Choose a swap for a planned meal from its ••• menu on the Meal Plan – the shopping list updates automatically.</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Estimated cost</h2>
              <EstimateBadge sources={costs.consumption.estimate.sources} />
            </div>
            <p className="text-3xl font-bold">
              ~{formatPence(costs.consumption.pence / servings)}
              <span className="text-base font-medium text-muted"> per portion</span>
            </p>
            <p className="mt-1 text-[15px]">
              <Money estimate={costs.consumption.estimate} range /> for {servings} portions of food used
            </p>
            <p className="mt-3 text-sm text-muted">
              Buying everything from scratch in whole packs: <strong className="text-text">~{formatPence(costs.purchase.pence)}</strong> – the difference stays in your
              cupboard for next time.
            </p>
            {costs.consumption.coverage < 1 && <p className="mt-2 text-sm text-warn">Some ingredients have no price data, so the real cost will be higher.</p>}
            <PriceDisclaimer className="mt-3" />
          </Card>

          <Card>
            <h2 className="mb-2 font-bold">Allergens</h2>
            {a.allergens.length === 0 && a.mayContain.length === 0 ? (
              <p className="text-[15px]">None of the 14 major allergens detected in the listed ingredients.</p>
            ) : (
              <>
                {a.allergens.length > 0 && (
                  <p className="text-[15px]">
                    <span className="font-semibold">Contains: </span>
                    {a.allergens.map((x) => ALLERGEN_LABELS[x]).join(", ")}
                  </p>
                )}
                {a.mayContain.length > 0 && (
                  <p className="mt-1 text-[15px]">
                    <span className="font-semibold">Often contains (brand-dependent): </span>
                    {a.mayContain.map((x) => ALLERGEN_LABELS[x]).join(", ")}
                  </p>
                )}
              </>
            )}
            {a.unverified.length > 0 && <p className="mt-2 text-sm text-warn">Couldn&apos;t check: {a.unverified.join(", ")}</p>}
            {a.diets.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.diets
                  .filter((d) => !["no-pork", "no-beef"].includes(d))
                  .map((d) => (
                    <Badge key={d} tone="green">
                      {DIET_LABELS[d]}
                    </Badge>
                  ))}
              </div>
            )}
            <AllergenCaveat className="mt-3" />
          </Card>

          <Card>
            <h2 className="mb-1 font-bold">Nutrition</h2>
            {recipe.nutrition ? (
              <p className="text-[15px]">
                {recipe.nutrition.kcal} kcal per portion · source: {recipe.nutrition.source}
              </p>
            ) : (
              <p className="text-sm text-muted">Not shown – we only display nutrition when reliable, verified data is available for a recipe.</p>
            )}
          </Card>
        </aside>
      </div>
      <AddToPlanSheet open={adding} onClose={() => setAdding(false)} recipeId={recipe.id} name={recipe.name} />
    </article>
  );
}

function AddToPlanSheet({ open, onClose, recipeId, name }: { open: boolean; onClose: () => void; recipeId: string; name: string }) {
  const current = useCurrentWeekStart();
  const [week, setWeek] = useState(current);
  const addMeal = useAppStore((s) => s.addMeal);
  const plans = useAppStore((s) => s.plans);
  const household = useAppStore((s) => s.household);
  const { byId } = useRecipes();
  const recipe = byId[recipeId];
  const defaultSlot: MealSlot = recipe?.mealTypes.includes("dinner") ? "dinner" : recipe?.mealTypes[0] ?? "dinner";
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const router = useRouter();
  const plan = plans.find((p) => p.weekStart === week);
  return (
    <Sheet open={open} onClose={onClose} title={`Add ${name}`}>
      <div className="mb-3 flex gap-2">
        {[current, addDays(current, 7)].map((w) => (
          <Chip key={w} selected={week === w} onClick={() => setWeek(w)}>
            {w === current ? "This week" : "Next week"}
          </Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((s) => (
          <Chip key={s} selected={slot === s} onClick={() => setSlot(s)} className="capitalize">
            {s}
          </Chip>
        ))}
      </div>
      <ul className="space-y-2">
        {weekDates(week).map((d, i) => {
          const existing = plan?.meals.find((m) => m.date === d && m.slot === slot);
          return (
            <li key={d}>
              <button
                type="button"
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 text-left hover:border-primary"
                onClick={() => {
                  if (existing && !confirm(`Replace ${byId[existing.recipeId]?.name ?? "the planned meal"}?`)) return;
                  toastResult(addMeal(week, d, slot, recipeId));
                  onClose();
                  router.push("/plan");
                }}
              >
                <span className="font-semibold">
                  {DAY_LONG[i]} <span className="font-normal text-muted">{formatDate(d, { day: "numeric", month: "short" })}</span>
                </span>
                <span className="truncate text-sm text-muted">{existing ? `Replaces ${byId[existing.recipeId]?.name ?? "meal"}` : household.planDays.includes(i) ? "Free" : "Day off"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
