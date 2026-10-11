"use client";

import Link from "next/link";
import { ArrowRight, Check, ChefHat, ShoppingBasket, Sparkles } from "lucide-react";
import { BudgetPanel } from "@/components/BudgetPanel";
import { Hydrated } from "@/components/Hydrated";
import { RecipeThumb } from "@/components/shared";
import { toastResult } from "@/components/toast";
import { Badge, Button, Card, LinkButton } from "@/components/ui";
import { lineGroup } from "@/lib/engine/shoppingText";
import { useAppStore } from "@/lib/store/appStore";
import { useActiveWeekStart, useRecipes, useToday, useWeekData } from "@/lib/store/hooks";
import { addDays, DAY_SHORT, daysBetween, formatDate, weekDates } from "@/lib/utils/dates";
import { dateStatus } from "@/lib/utils/foodDates";
import { formatPence } from "@/lib/utils/money";
import { useSyncExternalStore } from "react";

export default function HomePage() {
  return (
    <Hydrated>
      <Home />
    </Hydrated>
  );
}

const subscribeNoop = () => () => {};
function useGreeting() {
  return useSyncExternalStore(
    subscribeNoop,
    () => {
      const h = new Date().getHours();
      return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    },
    () => "Hello",
  );
}

function Home() {
  const weekStart = useActiveWeekStart();
  const today = useToday();
  const greeting = useGreeting();
  const { plan, lines, budget, shopping } = useWeekData(weekStart);
  const { byId } = useRecipes();
  const inventory = useAppStore((s) => s.inventory);
  const generateWeek = useAppStore((s) => s.generateWeek);
  const setCooked = useAppStore((s) => s.setCooked);
  const meals = plan?.meals ?? [];

  const slotRank = { breakfast: 0, lunch: 1, dinner: 2 } as const;
  const plans = useAppStore((s) => s.plans);
  // Next meal may be in this week or the next, whichever week is on show.
  const upcoming = plans
    .filter((p) => p.weekStart >= addDays(weekStart, -7) && p.weekStart <= addDays(weekStart, 7))
    .flatMap((p) => p.meals.map((m) => ({ ...m, weekStart: p.weekStart })))
    .filter((m) => !m.cooked && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || slotRank[a.slot] - slotRank[b.slot]);
  const next = upcoming[0];
  const nextRecipe = next && byId[next.recipeId];

  const toBuy = lines.filter((l) => lineGroup(l) === "buy");
  const left = toBuy.filter((l) => !l.checked).length + shopping.adhoc.filter((a) => !a.checked).length;
  const useSoon = inventory
    .map((i) => ({ i, st: dateStatus(i, today) }))
    .filter(({ i, st }) => st && i.location !== "freezer" && i.date && daysBetween(today, i.date) <= 2)
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-muted">{greeting} 👋</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
        </h1>
      </header>

      {!meals.length ? (
        <Card className="bg-primary-soft">
          <h2 className="text-xl font-bold">Let&apos;s plan this week</h2>
          <p className="mt-1 text-[15px] text-muted">We&apos;ll choose meals that fit your budget, reuse fresh ingredients and use up what you have.</p>
          <Button className="mt-4" icon={<Sparkles size={18} />} onClick={() => toastResult(generateWeek(weekStart))}>
            Generate my week
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{next ? (next.date === today ? `Today's ${next.slot}` : `Next up · ${formatDate(next.date, { weekday: "long" })} ${next.slot}`) : "All cooked this week 🎉"}</h2>
            <Link href="/plan" className="text-sm font-semibold text-primary">
              Full plan
            </Link>
          </div>
          {next && nextRecipe && (
            <div className="flex gap-4">
              <Link href={`/recipes/${nextRecipe.id}?servings=${next.servings}`}>
                <RecipeThumb recipe={nextRecipe} size="lg" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/recipes/${nextRecipe.id}?servings=${next.servings}`} className="text-lg font-semibold hover:underline">
                  {nextRecipe.name}
                </Link>
                <p className="text-sm text-muted">
                  {next.kind === "leftover" ? "Leftovers – just reheat" : `${nextRecipe.prepMins + nextRecipe.cookMins} min · ${next.servings} portions`}
                </p>
                {next.reasons?.[0] && <p className="mt-1 text-sm text-primary-strong">{next.reasons[0]}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <LinkButton href={`/recipes/${nextRecipe.id}?servings=${next.servings}`} size="sm" icon={<ChefHat size={16} />}>
                    Cook it
                  </LinkButton>
                  <Button size="sm" variant="secondary" icon={<Check size={16} />} onClick={() => toastResult(setCooked(next.weekStart, next.id, true))}>
                    Mark cooked
                  </Button>
                </div>
              </div>
            </div>
          )}
          <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="This week at a glance">
            {weekDates(weekStart).map((d, i) => {
              const dm = meals.filter((m) => m.date === d && m.slot === "dinner");
              const m = dm[0] ?? meals.find((x) => x.date === d);
              const r = m && byId[m.recipeId];
              return (
                <li key={d} className={`rounded-xl p-1.5 text-center ${d === today ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2"}`}>
                  <span className="block text-[11px] font-semibold text-muted">{DAY_SHORT[i]}</span>
                  <span className="block text-xl" aria-label={r ? r.name : "Nothing planned"} role="img">
                    {r ? (m.cooked ? "✅" : r.emoji) : "·"}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Shopping list</h2>
              <p className="text-[15px] text-muted">
                {toBuy.length + shopping.adhoc.length === 0 ? "Nothing to buy yet" : left === 0 ? "All ticked off 🎉" : `${left} item${left === 1 ? "" : "s"} still to get`}
              </p>
              {budget.shopping.pence > 0 && <p className="mt-1 text-2xl font-bold">~{formatPence(budget.shopping.pence)}</p>}
            </div>
            <ShoppingBasket className="text-accent" size={28} aria-hidden />
          </div>
          <LinkButton href="/shopping" variant="secondary" className="mt-3 w-full">
            Open list <ArrowRight size={18} aria-hidden />
          </LinkButton>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Use it up</h2>
          {useSoon.length ? (
            <ul className="mt-2 space-y-1.5">
              {useSoon.map(({ i, st }) => (
                <li key={i.id} className="flex items-center justify-between gap-2 text-[15px]">
                  <span className="capitalize">{i.name}</span>
                  {st && <Badge tone={st.tone}>{st.text}</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[15px] text-muted">
              {inventory.length ? "Nothing in My Food is close to its date." : "Add food you already have to cut waste and shrink your shopping list."}
            </p>
          )}
          <LinkButton href="/food" variant="secondary" className="mt-3 w-full">
            {inventory.length ? "Use what I have" : "Add food I have"}
          </LinkButton>
        </Card>
      </div>

      {meals.length > 0 && <BudgetPanel budget={budget} compact />}
    </div>
  );
}
