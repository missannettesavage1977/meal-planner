"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCheck, ChefHat, Pencil, Plus, Snowflake, Sparkles, Trash2 } from "lucide-react";
import { Hydrated } from "@/components/Hydrated";
import { RecipeThumb } from "@/components/shared";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Chip, EmptyState, Field, Notice, PageHeader, Sheet, cx, inputClass } from "@/components/ui";
import { INGREDIENTS } from "@/lib/data/ingredients";
import { STORAGE_LOCATIONS, type InventoryItem, type StorageLocation } from "@/lib/domain/types";
import { matchIngredient } from "@/lib/engine/normalise";
import { suggestFromInventory } from "@/lib/engine/planner";
import { formatRecipeQuantity } from "@/lib/engine/units";
import { plannerContext, useAppStore } from "@/lib/store/appStore";
import { useToday } from "@/lib/store/hooks";
import { daysBetween } from "@/lib/utils/dates";
import { dateStatus } from "@/lib/utils/foodDates";

export default function FoodPage() {
  return (
    <Hydrated>
      <FoodView />
    </Hydrated>
  );
}

const LOC_LABEL: Record<StorageLocation, string> = { cupboard: "Cupboard", fridge: "Fridge", freezer: "Freezer" };
const LOC_EMOJI: Record<StorageLocation, string> = { cupboard: "🥫", fridge: "🧊", freezer: "❄️" };

const QUICK_ADD = ["Onions", "Garlic", "Rice", "Pasta", "Chopped tomatoes", "Eggs", "Milk", "Cheddar", "Potatoes", "Carrots", "Frozen peas", "Spinach"];

function FoodView() {
  const today = useToday();
  const inventory = useAppStore((s) => s.inventory);
  const removeInventory = useAppStore((s) => s.removeInventory);
  const addInventory = useAppStore((s) => s.addInventory);
  const state = useAppStore();
  const [loc, setLoc] = useState<StorageLocation | "all">("all");
  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [showIdeas, setShowIdeas] = useState(false);

  const sorted = useMemo(() => {
    const list = inventory.filter((i) => loc === "all" || i.location === loc);
    return [...list].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.name.localeCompare(b.name));
  }, [inventory, loc]);

  const ideas = useMemo(() => (showIdeas ? suggestFromInventory(plannerContext(state)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showIdeas, state.inventory, state.household, state.userRecipes]);

  const soon = inventory.filter((i) => {
    if (!i.date || i.location === "freezer") return false;
    const d = daysBetween(today, i.date);
    return d <= 2 && !(i.dateType === "use-by" && d < 0);
  });

  return (
    <div>
      <PageHeader
        title="My Food"
        subtitle="What's in your cupboard, fridge and freezer. Anything here comes off your shopping list."
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setEditing("new")}>
            Add food
          </Button>
        }
      />

      <Card className="mb-5 bg-primary-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Use what I have</h2>
            <p className="text-[15px] text-muted">
              {soon.length ? `${soon.length} item${soon.length === 1 ? "" : "s"} need using soon. ` : ""}Find recipes that make the most of your food.
            </p>
          </div>
          <Button icon={<Sparkles size={18} />} onClick={() => setShowIdeas(true)} disabled={!inventory.length}>
            Show ideas
          </Button>
        </div>
      </Card>

      {inventory.length === 0 ? (
        <EmptyState icon="🧺" title="Nothing recorded yet">
          You don&apos;t need to list everything – just add things you want to use up or don&apos;t want to buy again.
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {QUICK_ADD.map((n) => (
              <Chip
                key={n}
                onClick={() => {
                  const ing = matchIngredient(n);
                  addInventory({ ingredientId: ing?.id ?? null, name: n, quantity: null, unit: "", location: ing && ["Dairy & eggs", "Fruit & veg"].includes(ing.category) && !["onion", "garlic", "potatoes"].includes(ing.id) ? "fridge" : ing?.category === "Frozen" ? "freezer" : "cupboard" });
                  toast(`Added ${n}`);
                }}
              >
                + {n}
              </Chip>
            ))}
          </div>
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Storage location">
            {(["all", ...STORAGE_LOCATIONS] as const).map((l) => (
              <Chip key={l} selected={loc === l} onClick={() => setLoc(l)}>
                {l === "all" ? `All (${inventory.length})` : `${LOC_EMOJI[l]} ${LOC_LABEL[l]} (${inventory.filter((i) => i.location === l).length})`}
              </Chip>
            ))}
          </div>
          <ul className="space-y-2">
            {sorted.map((item) => {
              const st = dateStatus(item, today);
              const ing = item.ingredientId ? INGREDIENTS.find((i) => i.id === item.ingredientId) : matchIngredient(item.name);
              return (
                <li key={item.id}>
                  <Card as="div" className="flex items-center gap-3 p-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>
                      {LOC_EMOJI[item.location]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold capitalize">{item.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <span>
                          {item.quantity === null ? "Some" : formatRecipeQuantity(item.quantity * (item.remaining ?? 1), item.unit || "item", ing ?? undefined)}
                          {item.remaining !== undefined && item.remaining < 1 && ` (about ${Math.round(item.remaining * 100)}% left)`}
                        </span>
                        {st && <Badge tone={st.tone}>{st.text}</Badge>}
                        {!ing && <span className="text-xs">not matched to a recipe ingredient</span>}
                      </p>
                      {st?.advice && (st.tone === "danger" || st.tone === "warn" || st.tone === "orange") && <p className="mt-1 text-sm">{st.advice}</p>}
                    </div>
                    <div className="flex shrink-0">
                      <button type="button" aria-label={`Edit ${item.name}`} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => setEditing(item)}>
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Used up ${item.name}`}
                        title="Used up"
                        className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2"
                        onClick={() => {
                          removeInventory(item.id);
                          toast(`${item.name} marked as used up`);
                        }}
                      >
                        <CheckCheck size={19} />
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Notice tone="info" title="Food safety in a nutshell" className="mt-6">
        <strong>Use-by</strong> dates are about safety – don&apos;t eat food after them. <strong>Best-before</strong> dates are about quality –
        food is usually fine after, so use your judgement. You can freeze most food right up to its use-by date. Dates you
        enter are optional reminders; we never decide that food is unsafe just because you didn&apos;t add one. See the{" "}
        <a className="underline" href="https://www.food.gov.uk/safety-hygiene/best-before-and-use-by-dates" target="_blank" rel="noreferrer">
          Food Standards Agency guidance
        </a>
        .
      </Notice>

      {editing && <InventoryForm item={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}

      <Sheet open={showIdeas} onClose={() => setShowIdeas(false)} title="Use what I have" wide>
        {ideas.length === 0 ? (
          <p className="py-4 text-muted">No suitable recipes use your recorded food yet. Try adding a few more fresh items.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">Ranked by how much of each recipe you already have, with items close to their date first.</p>
            <ul className="space-y-2">
              {ideas.map((s) => (
                <li key={s.recipe.id}>
                  <Link href={`/recipes/${s.recipe.id}`} className="flex gap-3 rounded-2xl border border-border p-3 hover:border-primary">
                    <RecipeThumb recipe={s.recipe} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{s.recipe.name}</span>
                      <span className="block text-sm text-primary-strong">Uses your {s.matched.slice(0, 4).join(", ")}</span>
                      {s.expiring.length > 0 && <span className="block text-sm font-medium text-accent">Rescues {s.expiring.join(", ")} before it goes off</span>}
                      <span className="block text-sm text-muted">{s.missingCount ? `${s.missingCount} more to buy: ${s.missing.slice(0, 4).join(", ")}${s.missing.length > 4 ? "…" : ""}` : "You have everything (except basics)!"}</span>
                    </span>
                    <ChefHat size={18} className="mt-1 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">Tip: open a recipe and tap “Add to plan” to cook it this week.</p>
          </>
        )}
      </Sheet>
    </div>
  );
}

const UNIT_CHOICES = ["", "g", "kg", "ml", "l", "item", "tin", "pack", "bunch", "clove", "slice"];

function InventoryForm({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const addInventory = useAppStore((s) => s.addInventory);
  const updateInventory = useAppStore((s) => s.updateInventory);
  const removeInventory = useAppStore((s) => s.removeInventory);
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState(item?.quantity != null ? String(item.quantity) : "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [location, setLocation] = useState<StorageLocation>(item?.location ?? "fridge");
  const [dateType, setDateType] = useState<"use-by" | "best-before">(item?.dateType ?? "use-by");
  const [date, setDate] = useState(item?.date ?? "");
  const [remaining, setRemaining] = useState(item?.remaining ?? 1);
  const [error, setError] = useState<string>();
  const match = name.trim() ? matchIngredient(name) : null;

  const save = () => {
    if (!name.trim()) return setError("Enter a name");
    const q = qty.trim() === "" ? null : Number(qty);
    if (q !== null && (!Number.isFinite(q) || q < 0)) return setError("Quantity must be a number");
    const data = {
      ingredientId: match?.id ?? null,
      name: name.trim(),
      quantity: q,
      unit: q === null ? "" : unit || (match?.baseUnit === "item" ? "item" : match?.baseUnit ?? "item"),
      location,
      dateType: date ? dateType : undefined,
      date: date || undefined,
      remaining: remaining < 1 ? remaining : undefined,
    };
    if (item) updateInventory(item.id, data);
    else addInventory(data);
    toast(item ? "Updated" : `Added ${name.trim()}`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={item ? `Edit ${item.name}` : "Add food"}
      footer={
        <div className="flex gap-2">
          {item && (
            <Button
              variant="danger"
              icon={<Trash2 size={18} />}
              onClick={() => {
                removeInventory(item.id);
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="What is it?" htmlFor="inv-name" error={error} hint={name.trim() ? (match ? `Matched to “${match.name}” – used in recipes and your list` : "Not matched to a recipe ingredient – it'll be kept but can't reduce your list") : undefined}>
          <input id="inv-name" className={inputClass} list="ingredient-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. spinach" autoFocus={!item} />
          <datalist id="ingredient-names">
            {INGREDIENTS.map((i) => (
              <option key={i.id} value={i.name} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (optional)" htmlFor="inv-qty">
            <input id="inv-qty" inputMode="decimal" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Leave blank for “some”" />
          </Field>
          <Field label="Unit" htmlFor="inv-unit">
            <select id="inv-unit" className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNIT_CHOICES.map((u) => (
                <option key={u} value={u}>
                  {u === "" ? "—" : u === "item" ? "items / whole" : u}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {item?.quantity != null && (
          <Field label={`Roughly how much is left? ${Math.round(remaining * 100)}%`} htmlFor="inv-left">
            <input id="inv-left" type="range" min={0.1} max={1} step={0.05} value={remaining} onChange={(e) => setRemaining(Number(e.target.value))} className="h-10 w-full" />
          </Field>
        )}
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">Where is it?</legend>
          <div className="flex flex-wrap gap-2">
            {STORAGE_LOCATIONS.map((l) => (
              <Chip key={l} selected={location === l} onClick={() => setLocation(l)}>
                {l === "freezer" ? <Snowflake size={15} aria-hidden /> : null}
                {LOC_LABEL[l]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">Date on the pack (optional)</legend>
          <div className="mb-2 flex gap-2">
            <Chip selected={dateType === "use-by"} onClick={() => setDateType("use-by")}>
              Use by
            </Chip>
            <Chip selected={dateType === "best-before"} onClick={() => setDateType("best-before")}>
              Best before
            </Chip>
          </div>
          <input type="date" aria-label="Date" className={cx(inputClass)} value={date} onChange={(e) => setDate(e.target.value)} />
        </fieldset>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
