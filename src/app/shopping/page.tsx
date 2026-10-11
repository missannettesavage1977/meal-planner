"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ClipboardCopy, PackageCheck, Plus, RotateCcw, Share2, ShoppingCart, Trash2, TriangleAlert } from "lucide-react";
import { BudgetPanel } from "@/components/BudgetPanel";
import { Hydrated } from "@/components/Hydrated";
import { EstimateBadge, Money, PriceDisclaimer } from "@/components/shared";
import { toast, toastResult } from "@/components/toast";
import { Badge, Button, Card, EmptyState, Field, LinkButton, PageHeader, Sheet, Toggle, cx, inputClass } from "@/components/ui";
import { CATEGORIES, SUPERMARKET_LABELS, type Category } from "@/lib/domain/types";
import type { ShoppingLine } from "@/lib/engine/consolidate";
import { categoryOrder, defaultLocation, displayName, exportShoppingText, lineGroup, needText, purchaseText, quantityText } from "@/lib/engine/shoppingText";
import { formatBaseQuantity } from "@/lib/engine/units";
import { useAppStore } from "@/lib/store/appStore";
import { useActiveWeekStart, useCurrentWeekStart, useWeekData } from "@/lib/store/hooks";
import { addDays, formatDate } from "@/lib/utils/dates";
import { formatPence, parsePounds } from "@/lib/utils/money";

export default function ShoppingPage() {
  return (
    <Hydrated>
      <ShoppingView />
    </Hydrated>
  );
}

function ShoppingView() {
  const weekStart = useCurrentWeekStart();
  const active = useActiveWeekStart();
  const [week, setWeek] = useState(active);
  const { plan, lines, budget, shopping } = useWeekData(week);
  const household = useAppStore((s) => s.household);
  const toggleChecked = useAppStore((s) => s.toggleChecked);
  const toggleAdhoc = useAppStore((s) => s.toggleAdhoc);
  const removeAdhoc = useAppStore((s) => s.removeAdhoc);
  const resetShopping = useAppStore((s) => s.resetShopping);
  const moveCheckedToInventory = useAppStore((s) => s.moveCheckedToInventory);
  const [mode, setMode] = useState(false);
  const [detail, setDetail] = useState<ShoppingLine | null>(null);
  const [adding, setAdding] = useState(false);
  const [showHome, setShowHome] = useState(false);

  const buy = lines.filter((l) => lineGroup(l) === "buy");
  const check = lines.filter((l) => lineGroup(l) === "check");
  const home = lines.filter((l) => lineGroup(l) === "home");
  const adhoc = shopping.adhoc;
  const remaining = buy.filter((l) => !l.checked).length + adhoc.filter((a) => !a.checked).length;
  const total = buy.length + adhoc.length;
  const checkedLines = buy.filter((l) => l.checked);

  const grouped = (() => {
    const map = new Map<Category, { lines: ShoppingLine[]; adhoc: typeof adhoc }>();
    for (const l of buy) {
      const g = map.get(l.category) ?? { lines: [], adhoc: [] };
      g.lines.push(l);
      map.set(l.category, g);
    }
    for (const a of adhoc) {
      const g = map.get(a.category) ?? { lines: [], adhoc: [] };
      g.adhoc.push(a);
      map.set(a.category, g);
    }
    return [...map.entries()].sort((a, b) => categoryOrder(a[0]) - categoryOrder(b[0]));
  })();

  const weekLabel = week === weekStart ? "this week" : `week of ${formatDate(week, { day: "numeric", month: "short" })}`;
  const text = () => exportShoppingText(lines, adhoc, { supermarket: household.supermarket, weekLabel, totalPence: budget.shopping.pence + budget.adhocPence });

  const share = async () => {
    const t = text();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Shopping list", text: t });
        return;
      } catch {
        /* user cancelled – fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(t);
      toast("Shopping list copied – paste it anywhere");
    } catch {
      toast("Couldn't copy automatically", "error");
    }
  };

  const noPlan = !plan || plan.meals.length === 0;

  return (
    <div>
      <PageHeader
        title="Shopping list"
        subtitle={`${SUPERMARKET_LABELS[household.supermarket]} · ${weekLabel}`}
        actions={
          <>
            <Button variant={mode ? "primary" : "secondary"} size="sm" icon={<ShoppingCart size={18} />} onClick={() => setMode(!mode)} aria-pressed={mode}>
              {mode ? "Exit shopping mode" : "Shopping mode"}
            </Button>
            <Button variant="secondary" size="sm" icon={<Share2 size={18} />} onClick={share} disabled={!total}>
              Share
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Week:</span>
        {[weekStart, addDays(weekStart, 7)].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWeek(w)}
            className={cx("min-h-9 rounded-full border px-3 font-medium", w === week ? "border-primary bg-primary-soft text-primary-strong" : "border-border")}
          >
            {w === weekStart ? "This week" : "Next week"}
          </button>
        ))}
      </div>

      {noPlan && !adhoc.length ? (
        <EmptyState icon="🛒" title="Your list is empty" action={<LinkButton href="/plan">Plan some meals</LinkButton>}>
          Plan your meals and we&apos;ll combine every ingredient into one list – or add your own items below.
          <div className="mt-4">
            <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
              Add an item
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className={cx("grid gap-5", !mode && "lg:grid-cols-[1fr_340px]")}>
          <div className="min-w-0">
            {/* Progress + totals */}
            <Card className={cx("mb-4", mode && "sticky top-2 z-10")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{remaining === 0 && total > 0 ? "All done! 🎉" : `${remaining} of ${total} items left`}</p>
                  <p className="text-xl font-bold">
                    <Money estimate={budget.shopping} />{" "}
                    <span className="text-sm font-medium text-muted">est. total</span>
                  </p>
                </div>
                <EstimateBadge sources={budget.shopping.sources} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? ((total - remaining) / total) * 100 : 0}%` }} />
              </div>
            </Card>

            {grouped.map(([cat, g]) => (
              <section key={cat} className="mb-5" aria-label={cat}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{cat}</h2>
                <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                  {[...g.lines]
                    .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name))
                    .map((l) => (
                      <LineRow key={l.key} line={l} mode={mode} onToggle={() => toggleChecked(week, l.key)} onOpen={() => setDetail(l)} />
                    ))}
                  {g.adhoc.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 border-b border-border px-3 last:border-0">
                      <input type="checkbox" className={cx("shrink-0", mode ? "h-7 w-7" : "h-6 w-6")} checked={a.checked} onChange={() => toggleAdhoc(week, a.id)} aria-label={`Got ${a.name}`} />
                      <div className={cx("min-w-0 flex-1 py-3", a.checked && "text-muted line-through")}>
                        <p className={cx("font-semibold", mode && "text-lg")}>{a.name}</p>
                        <p className="text-sm text-muted">
                          {a.quantity || "Added by you"}
                          {a.pricePence !== undefined && ` · ~${formatPence(a.pricePence)}`}
                        </p>
                      </div>
                      {!mode && (
                        <button type="button" aria-label={`Remove ${a.name}`} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => removeAdhoc(week, a.id)}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="mb-6 flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
                Add an item
              </Button>
              {checkedLines.length > 0 && (
                <Button
                  variant="secondary"
                  icon={<PackageCheck size={18} />}
                  onClick={() => {
                    const items = checkedLines.map((l) => ({
                      key: l.key,
                      ingredientId: l.ingredientId,
                      name: l.ingredient?.name ?? l.name,
                      quantity: l.purchase?.quantity || l.toBuy,
                      unit: l.unit,
                      location: defaultLocation(l.category),
                    }));
                    toastResult(moveCheckedToInventory(week, items));
                  }}
                >
                  Put ticked items in My Food
                </Button>
              )}
              {(checkedLines.length > 0 || adhoc.some((a) => a.checked)) && (
                <Button variant="ghost" icon={<RotateCcw size={18} />} onClick={() => resetShopping(week)}>
                  Untick all
                </Button>
              )}
              <Button
                variant="ghost"
                icon={<ClipboardCopy size={18} />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text());
                    toast("Copied as plain text");
                  } catch {
                    toast("Couldn't copy", "error");
                  }
                }}
              >
                Copy as text
              </Button>
            </div>

            {!mode && check.length > 0 && (
              <section className="mb-5" aria-label="Check you have">
                <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Check you have</h2>
                <p className="mb-2 text-sm text-muted">Store-cupboard basics and things in My Food without a recorded amount. Not counted in the total.</p>
                <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                  {check.map((l) => (
                    <LineRow key={l.key} line={l} mode={false} muted onOpen={() => setDetail(l)} />
                  ))}
                </ul>
              </section>
            )}

            {!mode && home.length > 0 && (
              <section className="mb-5">
                <button type="button" className="mb-2 flex min-h-10 items-center gap-1 text-sm font-bold uppercase tracking-wide text-muted" onClick={() => setShowHome(!showHome)} aria-expanded={showHome}>
                  Already at home ({home.length}) <ChevronDown size={16} className={cx("transition-transform", showHome && "rotate-180")} aria-hidden />
                </button>
                {showHome && (
                  <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                    {home.map((l) => (
                      <LineRow key={l.key} line={l} mode={false} muted onOpen={() => setDetail(l)} />
                    ))}
                  </ul>
                )}
              </section>
            )}
            <PriceDisclaimer />
          </div>

          {!mode && (
            <div className="space-y-4">
              <BudgetPanel budget={budget} />
            </div>
          )}
        </div>
      )}

      {detail && <LineDetail week={week} line={lines.find((l) => l.key === detail.key) ?? detail} onClose={() => setDetail(null)} />}
      <AddItemSheet open={adding} onClose={() => setAdding(false)} week={week} />
    </div>
  );
}

function LineRow({ line, mode, onToggle, onOpen, muted }: { line: ShoppingLine; mode: boolean; onToggle?: () => void; onOpen: () => void; muted?: boolean }) {
  const buyText = purchaseText(line);
  return (
    <li className="flex items-center gap-3 border-b border-border px-3 last:border-0">
      {onToggle ? (
        <input
          type="checkbox"
          className={cx("shrink-0", mode ? "h-7 w-7" : "h-6 w-6")}
          checked={line.checked}
          onChange={onToggle}
          aria-label={`Got ${line.name}`}
        />
      ) : (
        <span className="w-6 shrink-0 text-center text-muted" aria-hidden>
          ✓
        </span>
      )}
      <button type="button" onClick={onOpen} className={cx("flex min-w-0 flex-1 items-center gap-3 py-3 text-left", line.checked && "text-muted line-through")}>
        <span className="min-w-0 flex-1">
          <span className={cx("block font-semibold", mode && "text-lg", muted && "font-medium")}>
            {displayName(line)}
            {line.warnings.length > 0 && <TriangleAlert size={14} className="ml-1 inline text-warn" aria-label="Has a note" />}
          </span>
          <span className={cx("block text-muted", mode ? "text-base" : "text-sm")}>
            {line.toBuy > 0 ? buyText : line.staple ? "Store cupboard" : line.owned ? "You have this" : needText(line)}
            {!mode && line.toBuy > 0 && <span className="hidden sm:inline"> · {needText(line)}</span>}
            {line.overridden && " · edited"}
          </span>
        </span>
        {line.purchaseCost.pence > 0 && <span className={cx("shrink-0 tabular-nums", mode ? "text-base" : "text-sm text-muted")}>{formatPence(line.purchaseCost.pence)}</span>}
        {line.toBuy > 0 && !line.purchase?.priced && line.ingredientId && <span className="shrink-0 text-xs text-muted">no price</span>}
      </button>
    </li>
  );
}

function LineDetail({ line, week, onClose }: { line: ShoppingLine; week: string; onClose: () => void }) {
  const setOwned = useAppStore((s) => s.setOwned);
  const setOverride = useAppStore((s) => s.setOverride);
  const toggleAlwaysHave = useAppStore((s) => s.toggleAlwaysHave);
  const staples = useAppStore((s) => s.household.cupboardStaples);
  const [qty, setQty] = useState(String(Math.round(line.toBuy * 100) / 100));
  const unitLabel = line.unit === "item" ? line.ingredient?.itemLabelPlural ?? "items" : line.unit;
  return (
    <Sheet open onClose={onClose} title={displayName(line)}>
      <div className="space-y-5">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <dt className="text-xs text-muted">Needed</dt>
            <dd className="font-bold">{quantityText(line, line.required)}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <dt className="text-xs text-muted">At home</dt>
            <dd className="font-bold">{line.coveredByUnknownInventory ? "Some" : quantityText(line, line.available)}</dd>
          </div>
          <div className="rounded-xl bg-primary-soft p-2">
            <dt className="text-xs text-muted">To buy</dt>
            <dd className="font-bold">{line.toBuy > 0 ? quantityText(line, line.toBuy) : "–"}</dd>
          </div>
        </dl>

        {line.purchase && line.purchase.packs.length > 0 && (
          <div>
            <p className="font-semibold">Suggested packs</p>
            <ul className="mt-1 space-y-1 text-[15px]">
              {line.purchase.packs.map((p) => (
                <li key={p.label} className="flex justify-between gap-2">
                  <span>
                    {p.count} × {p.label}
                    {p.product?.source === "manual" && <Badge tone="green" className="ml-2">your price</Badge>}
                  </span>
                  {p.pricePence !== undefined && <span className="tabular-nums">{formatPence(p.pricePence * p.count)}</span>}
                </li>
              ))}
            </ul>
            {line.purchase.surplus > 0 && (
              <p className="mt-1 text-sm text-muted">
                About {formatBaseQuantity(line.purchase.surplus, line.unit, line.ingredient)} left over for another time
                {line.ingredient && line.ingredient.shelfLifeDays <= 7 ? " – use it soon or freeze it." : "."}
              </p>
            )}
            <p className="mt-1 text-sm text-muted">
              Food used: <Money estimate={line.consumptionCost} /> · Packs to buy: <Money estimate={line.purchaseCost} range />
              {line.purchase.packs[0]?.product?.lastChecked ? ` · checked ${formatDate(line.purchase.packs[0].product.lastChecked)}` : " · demo estimate, not checked with a retailer"}
            </p>
          </div>
        )}

        <div>
          <p className="font-semibold">Used in</p>
          <ul className="mt-1 space-y-1 text-[15px]">
            {line.recipes.map((r) => (
              <li key={r.recipeId}>
                <Link href={`/recipes/${r.recipeId}`} className="underline">
                  {r.recipeName}
                </Link>{" "}
                <span className="text-muted">– {r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {line.warnings.map((w) => (
          <p key={w} className="rounded-xl bg-warn-soft p-3 text-sm">
            {w}
          </p>
        ))}
        {line.ingredient?.note && <p className="text-sm text-muted">{line.ingredient.note}</p>}

        <Field label={`Quantity to buy (${unitLabel})`} htmlFor="qty-edit" hint="Override if you want more or less than we calculated.">
          <div className="flex gap-2">
            <input id="qty-edit" inputMode="decimal" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button
              variant="secondary"
              onClick={() => {
                const n = Number(qty);
                if (!Number.isFinite(n) || n < 0) return toast("Enter a number", "error");
                setOverride(week, line.key, n);
                toast("Quantity updated");
              }}
            >
              Save
            </Button>
          </div>
          {line.overridden && (
            <button type="button" className="mt-1 text-sm font-semibold text-primary underline" onClick={() => setOverride(week, line.key, null)}>
              Reset to calculated amount
            </button>
          )}
        </Field>

        <Toggle label="I already have this" description="Removes it from this week's list." checked={line.owned} onChange={(v) => setOwned(week, line.key, v)} />
        {line.ingredientId && (
          <Toggle
            label="I always keep this in"
            description="Treat as a store-cupboard staple every week (Settings → Store cupboard)."
            checked={staples.includes(line.ingredientId)}
            onChange={() => toggleAlwaysHave(line.ingredientId!)}
          />
        )}
      </div>
    </Sheet>
  );
}

function AddItemSheet({ open, onClose, week }: { open: boolean; onClose: () => void; week: string }) {
  const addAdhoc = useAppStore((s) => s.addAdhoc);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [cat, setCat] = useState<Category>("Other");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string>();
  const submit = () => {
    if (!name.trim()) return setError("Enter what you need");
    const p = price.trim() ? parsePounds(price) : undefined;
    if (p === null) return setError("Price should look like 1.50");
    addAdhoc(week, { name: name.trim(), quantity: qty.trim(), category: cat, pricePence: p });
    toast(`Added ${name.trim()}`);
    setName("");
    setQty("");
    setPrice("");
    setError(undefined);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add to shopping list"
      footer={
        <Button className="w-full" onClick={submit}>
          Add item
        </Button>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Item" htmlFor="adhoc-name" error={error}>
          <input id="adhoc-name" className={inputClass} placeholder="e.g. Toilet roll, bananas" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Quantity (optional)" htmlFor="adhoc-qty">
          <input id="adhoc-qty" className={inputClass} placeholder="e.g. 2 packs" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Aisle" htmlFor="adhoc-cat">
          <select id="adhoc-cat" className={inputClass} value={cat} onChange={(e) => setCat(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Price (optional)" htmlFor="adhoc-price" hint="Counts towards your budget if it covers all groceries.">
          <input id="adhoc-price" inputMode="decimal" className={inputClass} placeholder="£" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
