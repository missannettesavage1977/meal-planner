"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, FileText, Heart, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Hydrated } from "@/components/Hydrated";
import { RecipeThumb } from "@/components/shared";
import { Badge, Chip, EmptyState, LinkButton, PageHeader, Toggle, cx, inputClass } from "@/components/ui";
import { CUISINES, CUISINE_LABELS, type Diet, type MealSlot } from "@/lib/domain/types";
import { mealConsumptionCost } from "@/lib/engine/budget";
import { analyseRecipe, checkSuitability, recipeTags } from "@/lib/engine/recipeMeta";
import { useAppStore } from "@/lib/store/appStore";
import { usePriceBook, useRecipes } from "@/lib/store/hooks";
import { formatPence } from "@/lib/utils/money";

export default function RecipesPage() {
  return (
    <Hydrated>
      <RecipesView />
    </Hydrated>
  );
}

const DIET_FILTERS: Diet[] = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free"];
const TIME_FILTERS = [0, 30, 45, 60];
const COST_FILTERS = [0, 150, 250];

function RecipesView() {
  const { list } = useRecipes();
  const household = useAppStore((s) => s.household);
  const favourites = useAppStore((s) => s.favouriteRecipeIds);
  const toggleFavourite = useAppStore((s) => s.toggleFavourite);
  const priceBook = usePriceBook();
  const [q, setQ] = useState("");
  const [meal, setMeal] = useState<MealSlot | "all">("all");
  const [diets, setDiets] = useState<Diet[]>([]);
  const [maxTime, setMaxTime] = useState(0);
  const [maxCost, setMaxCost] = useState(0);
  const [cuisine, setCuisine] = useState("");
  const [suitableOnly, setSuitableOnly] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<"name" | "time" | "cost">("name");

  const enriched = useMemo(
    () =>
      list.map((r) => {
        const a = analyseRecipe(r);
        const cost = mealConsumptionCost(r, r.servings, household, priceBook);
        return {
          r,
          a,
          tags: recipeTags(r),
          perPortion: cost.pence / r.servings,
          coverage: cost.coverage,
          suit: checkSuitability(r, household),
          hay: `${r.name} ${r.description} ${r.cuisine} ${r.tags.join(" ")} ${r.ingredients.map((i) => i.name).join(" ")}`.toLowerCase(),
        };
      }),
    [list, household, priceBook],
  );

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = enriched
    .filter((x) => (meal === "all" ? true : x.r.mealTypes.includes(meal)))
    .filter((x) => diets.every((d) => x.a.diets.includes(d)))
    .filter((x) => !maxTime || x.a.totalMins <= maxTime)
    .filter((x) => !maxCost || x.perPortion <= maxCost)
    .filter((x) => !cuisine || x.r.cuisine === cuisine)
    .filter((x) => !suitableOnly || x.suit.ok)
    .filter((x) => !favOnly || favourites.includes(x.r.id))
    .filter((x) => words.every((w) => x.hay.includes(w)))
    .sort((a, b) => (sort === "time" ? a.a.totalMins - b.a.totalMins : sort === "cost" ? a.perPortion - b.perPortion : a.r.name.localeCompare(b.r.name)));
  const hiddenCount = enriched.filter((x) => !x.suit.ok).length;
  const activeFilters = diets.length + (maxTime ? 1 : 0) + (maxCost ? 1 : 0) + (cuisine ? 1 : 0) + (favOnly ? 1 : 0);

  return (
    <div>
      <PageHeader
        title="Recipes"
        subtitle={`${list.length} recipes · original, written for this app`}
        actions={
          <>
            <LinkButton href="/recipes/new?mode=import" variant="secondary" size="sm" icon={<FileText size={18} />}>
              Import text
            </LinkButton>
            <LinkButton href="/recipes/new" size="sm" icon={<Plus size={18} />}>
              New recipe
            </LinkButton>
          </>
        }
      />

      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          className={`${inputClass} pl-10`}
          placeholder="Search by name or ingredient – e.g. “spinach”"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search recipes"
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {(["all", "dinner", "lunch", "breakfast"] as const).map((m) => (
          <Chip key={m} selected={meal === m} onClick={() => setMeal(m)} className="shrink-0 capitalize">
            {m === "all" ? "All meals" : m}
          </Chip>
        ))}
        <Chip selected={showFilters} onClick={() => setShowFilters(!showFilters)} className="shrink-0">
          <SlidersHorizontal size={16} aria-hidden /> Filters{activeFilters ? ` (${activeFilters})` : ""}
        </Chip>
      </div>

      {showFilters && (
        <div className="mb-4 space-y-4 rounded-2xl border border-border bg-surface p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Diet</legend>
            <div className="flex flex-wrap gap-2">
              {DIET_FILTERS.map((d) => (
                <Chip key={d} selected={diets.includes(d)} onClick={() => setDiets(diets.includes(d) ? diets.filter((x) => x !== d) : [...diets, d])} className="capitalize">
                  {d}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Total time</legend>
            <div className="flex flex-wrap gap-2">
              {TIME_FILTERS.map((t) => (
                <Chip key={t} selected={maxTime === t} onClick={() => setMaxTime(t)}>
                  {t ? `≤ ${t} min` : "Any"}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Estimated cost per portion</legend>
            <div className="flex flex-wrap gap-2">
              {COST_FILTERS.map((c) => (
                <Chip key={c} selected={maxCost === c} onClick={() => setMaxCost(c)}>
                  {c ? `Under ${formatPence(c)}` : "Any"}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Cuisine
              <select className={`${inputClass} mt-1`} value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
                <option value="">Any cuisine</option>
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {CUISINE_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Sort by
              <select className={`${inputClass} mt-1`} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="name">Name</option>
                <option value="time">Quickest</option>
                <option value="cost">Cheapest per portion</option>
              </select>
            </label>
          </div>
          <Toggle label="Favourites only" checked={favOnly} onChange={setFavOnly} />
          <Toggle
            label="Only recipes that suit my household"
            description={`Hides ${hiddenCount} recipe${hiddenCount === 1 ? "" : "s"} that don't fit your allergies, diet, dislikes or equipment.`}
            checked={suitableOnly}
            onChange={setSuitableOnly}
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No recipes match">
          Try fewer filters or a different search.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ r, a, tags, perPortion, suit }) => (
            <li key={r.id} className="relative">
              <Link href={`/recipes/${r.id}`} className="flex h-full gap-3 rounded-2xl border border-border bg-surface p-3 pr-12 hover:border-primary">
                <RecipeThumb recipe={r} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{r.name}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} aria-hidden /> {a.totalMins} min
                    </span>
                    {perPortion > 0 && <span>~{formatPence(perPortion)}/portion</span>}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {!suit.ok && <Badge tone="danger">Not suitable</Badge>}
                    {r.source !== "original" && <Badge tone="info">Your recipe</Badge>}
                    {tags.slice(0, 3).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => toggleFavourite(r.id)}
                aria-pressed={favourites.includes(r.id)}
                aria-label={favourites.includes(r.id) ? `Remove ${r.name} from favourites` : `Add ${r.name} to favourites`}
                className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2"
              >
                <Heart size={20} className={cx(favourites.includes(r.id) ? "fill-accent text-accent" : "text-muted")} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
