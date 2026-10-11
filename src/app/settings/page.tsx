"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { Hydrated } from "@/components/Hydrated";
import {
  DietSection,
  HouseholdSizeSection,
  MealsSection,
  ShopBudgetSection,
  StaplesSection,
  StyleSection,
  TastesSection,
  TimeSkillSection,
  WeightsSection,
} from "@/components/HouseholdForm";
import { toast, toastResult } from "@/components/toast";
import { Badge, Button, Card, Field, Notice, PageHeader, cx, inputClass } from "@/components/ui";
import { INGREDIENTS, getIngredient } from "@/lib/data/ingredients";
import { DEFAULT_WEIGHTS, SUPERMARKETS, SUPERMARKET_LABELS, type Household, type Supermarket } from "@/lib/domain/types";
import { demoPriceProvider } from "@/lib/pricing/demoProvider";
import { toBase } from "@/lib/engine/units";
import { useAppStore } from "@/lib/store/appStore";
import { useToday } from "@/lib/store/hooks";
import { formatDate } from "@/lib/utils/dates";
import { formatPence, parsePounds } from "@/lib/utils/money";

export default function SettingsPage() {
  return (
    <Hydrated>
      <SettingsView />
    </Hydrated>
  );
}

function Section({ id, title, subtitle, children, defaultOpen }: { id?: string; title: string; subtitle?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <Card className="p-0" as="section">
      <h2 id={id}>
        <button type="button" className="flex min-h-16 w-full items-center justify-between gap-3 px-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span>
            <span className="block text-lg font-bold">{title}</span>
            {subtitle && <span className="block text-sm font-normal text-muted">{subtitle}</span>}
          </span>
          <ChevronDown className={cx("shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      {open && <div className="border-t border-border px-4 py-5">{children}</div>}
    </Card>
  );
}

function SettingsView() {
  const household = useAppStore((s) => s.household);
  const updateHousehold = useAppStore((s) => s.updateHousehold);
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const resetAll = useAppStore((s) => s.resetAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const patch = (p: Partial<Household>) => updateHousehold(p);
  const props = { value: household, onChange: patch };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader title="Settings" subtitle="Changes save automatically and apply to new plans." />
      <Section title="Household" subtitle={`${household.adults} adult${household.adults > 1 ? "s" : ""}${household.children ? `, ${household.children} child${household.children > 1 ? "ren" : ""}` : ""} · ${household.portionsPerMeal} portions per meal`}>
        <HouseholdSizeSection {...props} />
      </Section>
      <Section title="Supermarket & budget" subtitle={`${SUPERMARKET_LABELS[household.supermarket]} · ${formatPence(household.weeklyBudgetPence)} a week`}>
        <ShopBudgetSection {...props} />
      </Section>
      <Section title="Meals to plan" subtitle={`${household.slots.join(", ")} · ${household.planDays.length} days`}>
        <MealsSection {...props} />
      </Section>
      <Section title="Time, skill & equipment">
        <TimeSkillSection {...props} />
      </Section>
      <Section title="Diets, allergies & dislikes" subtitle={[...household.diets, ...household.allergens, ...household.allergyTerms].join(", ") || "None set"}>
        <DietSection {...props} />
      </Section>
      <Section title="Tastes & favourites">
        <TastesSection {...props} />
      </Section>
      <Section title="Cooking style & priorities">
        <StyleSection {...props} />
      </Section>
      <Section title="Store cupboard" subtitle="Basics you always have in">
        <StaplesSection {...props} />
      </Section>
      <Section title="How meals are chosen" subtitle="Advanced: planner weights">
        <WeightsSection {...props} />
        <Button variant="ghost" className="mt-4" icon={<RotateCcw size={18} />} onClick={() => patch({ weights: DEFAULT_WEIGHTS })}>
          Reset to defaults
        </Button>
      </Section>
      <Section id="prices" title="Prices" subtitle="Add real prices you've seen to improve estimates">
        <PricesSection />
      </Section>
      <Section title="Your data" subtitle="Back up, restore or reset">
        <div className="space-y-4">
          <p className="text-[15px]">
            Everything is stored privately in this browser on this device. Nothing is sent to a server. Back up regularly, or to move to another device.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<Download size={18} />}
              onClick={() => {
                const blob = new Blob([exportData()], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `plate-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast("Backup downloaded");
              }}
            >
              Download backup
            </Button>
            <Button variant="secondary" icon={<Upload size={18} />} onClick={() => fileRef.current?.click()}>
              Restore backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!confirm("Replace everything on this device with this backup?")) return;
                toastResult(importData(await f.text()));
                e.target.value = "";
              }}
            />
          </div>
          <Button
            variant="danger"
            icon={<Trash2 size={18} />}
            onClick={() => {
              if (confirm("Delete all your plans, food, recipes and settings from this device? This can't be undone.")) {
                resetAll();
                router.push("/onboarding");
              }
            }}
          >
            Delete all my data
          </Button>
        </div>
      </Section>
      <Section title="About & limitations">
        <div className="space-y-3 text-[15px] leading-relaxed">
          <p>
            <strong>Prices.</strong> {demoPriceProvider.description} No supermarket account is connected and no live prices are fetched. Your own prices (above) take priority.
          </p>
          <p>
            <strong>Allergens.</strong> Worked out from typical ingredient composition. Brands differ and cross-contamination isn&apos;t covered – always read labels.
          </p>
          <p>
            <strong>Nutrition.</strong> Not shown unless reliable data exists for a recipe.
          </p>
          <p>
            <strong>Recipes.</strong> The built-in recipes are original to this app. Imported recipes are stored only on your device.
          </p>
        </div>
      </Section>
    </div>
  );
}

function PricesSection() {
  const household = useAppStore((s) => s.household);
  const manual = useAppStore((s) => s.manualProducts);
  const addManualProduct = useAppStore((s) => s.addManualProduct);
  const removeManualProduct = useAppStore((s) => s.removeManualProduct);
  const today = useToday();
  const [ingredientId, setIngredientId] = useState("");
  const [supermarket, setSupermarket] = useState<Supermarket>(household.supermarket);
  const [productName, setProductName] = useState("");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState("g");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string>();
  const ing = getIngredient(ingredientId);

  const save = () => {
    if (!ing) return setError("Choose an ingredient");
    const pence = parsePounds(price);
    if (pence === null || pence <= 0) return setError("Enter the shelf price, e.g. 1.25");
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0) return setError("Enter the pack size");
    const base = toBase(ing, n, unit);
    if (base === null) return setError(`Can't convert ${unit} for ${ing.name} – try ${ing.baseUnit === "item" ? "items" : ing.baseUnit}`);
    addManualProduct({
      supermarket,
      ingredientId: ing.id,
      name: productName.trim() || `${ing.name} ${n}${unit}`,
      ownBrand: false,
      packSize: base,
      packLabel: `${n}${unit === "item" ? (n === 1 ? " item" : " pack") : unit}`,
      pricePence: pence,
      lastChecked: date || today,
    });
    toast("Price saved – estimates updated");
    setPrice("");
    setSize("");
    setProductName("");
    setError(undefined);
  };

  return (
    <div className="space-y-5">
      <Notice tone="warn">
        Built-in prices are illustrative demonstration data, not live supermarket prices. Enter prices from the shelf, receipt or
        retailer website and they&apos;ll replace the demo figures for that ingredient and supermarket.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ingredient" htmlFor="p-ing">
          <select
            id="p-ing"
            className={inputClass}
            value={ingredientId}
            onChange={(e) => {
              setIngredientId(e.target.value);
              const i = getIngredient(e.target.value);
              if (i) setUnit(i.baseUnit);
            }}
          >
            <option value="">Choose…</option>
            {[...INGREDIENTS].sort((a, b) => a.name.localeCompare(b.name)).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supermarket" htmlFor="p-sm">
          <select id="p-sm" className={inputClass} value={supermarket} onChange={(e) => setSupermarket(e.target.value as Supermarket)}>
            {SUPERMARKETS.map((s) => (
              <option key={s} value={s}>
                {SUPERMARKET_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Product name (optional)" htmlFor="p-name">
          <input id="p-name" className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Stockwell basmati 1kg" />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Field label="Pack size" htmlFor="p-size">
            <input id="p-size" inputMode="decimal" className={inputClass} value={size} onChange={(e) => setSize(e.target.value)} />
          </Field>
          <Field label="Unit" htmlFor="p-unit">
            <select id="p-unit" className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {["g", "kg", "ml", "l", "item", ...Object.keys(ing?.customUnits ?? {})].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Price" htmlFor="p-price">
          <input id="p-price" inputMode="decimal" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="£" />
        </Field>
        <Field label="Date seen" htmlFor="p-date">
          <input id="p-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {error && (
        <p className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <Button onClick={save}>Save price</Button>

      {manual.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {manual.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted">
                  {SUPERMARKET_LABELS[p.supermarket]} · {p.packLabel} · {formatPence(p.pricePence)} · seen {p.lastChecked ? formatDate(p.lastChecked) : "–"}
                </p>
              </div>
              <Badge tone="green">Your price</Badge>
              <button type="button" aria-label={`Delete price for ${p.name}`} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => removeManualProduct(p.id)}>
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
