"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import {
  ALLERGENS,
  ALLERGEN_LABELS,
  CUISINES,
  CUISINE_LABELS,
  DIETS,
  DIET_LABELS,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  SUPERMARKETS,
  SUPERMARKET_LABELS,
  type Household,
  type MealSlot,
  type PlannerWeights,
} from "@/lib/domain/types";
import { INGREDIENTS } from "@/lib/data/ingredients";
import { CRITERION_LABELS } from "@/lib/engine/planner";
import { DAY_SHORT } from "@/lib/utils/dates";
import { parsePounds } from "@/lib/utils/money";
import { Button, Chip, Field, Notice, Stepper, Toggle, inputClass } from "./ui";

type Patch = (p: Partial<Household>) => void;
interface SectionProps {
  value: Household;
  onChange: Patch;
}

function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function suggestedPortions(adults: number, children: number) {
  return Math.max(1, Math.ceil((adults + children * 0.6) * 2) / 2);
}

export function HouseholdSizeSection({ value, onChange }: SectionProps) {
  const update = (adults: number, children: number) =>
    onChange({ adults, children, portionsPerMeal: suggestedPortions(adults, children) });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold">Adults (and teenagers)</p>
        </div>
        <Stepper label="adults" value={value.adults} min={1} max={12} onChange={(v) => update(v, value.children)} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold">Children</p>
          <p className="text-sm text-muted">Counted as smaller portions</p>
        </div>
        <Stepper label="children" value={value.children} min={0} max={12} onChange={(v) => update(value.adults, v)} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-2 p-3">
        <div>
          <p className="text-[15px] font-semibold">Portions to cook per meal</p>
          <p className="text-sm text-muted">Adjust if you have big eaters or want lunch leftovers</p>
        </div>
        <Stepper label="portions per meal" value={value.portionsPerMeal} min={1} max={24} step={0.5} onChange={(v) => onChange({ portionsPerMeal: v })} />
      </div>
    </div>
  );
}

export function ShopBudgetSection({ value, onChange }: SectionProps) {
  const id = useId();
  const [text, setText] = useState(((value.weeklyBudgetPence ?? 0) / 100).toFixed(2));
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Where do you usually shop?</legend>
        <div className="flex flex-wrap gap-2">
          {SUPERMARKETS.map((s) => (
            <Chip key={s} selected={value.supermarket === s} onClick={() => onChange({ supermarket: s })}>
              {SUPERMARKET_LABELS[s]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Used for price estimates and pack sizes. No supermarket account is needed.</p>
      </fieldset>
      <Field label="Weekly food budget" htmlFor={id} error={error} hint="We'll estimate what your plan costs against this.">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">£</span>
          <input
            id={id}
            inputMode="decimal"
            className={`${inputClass} pl-8`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const p = parsePounds(e.target.value);
              if (p === null) setError("Enter an amount like 60 or 59.50");
              else {
                setError(undefined);
                onChange({ weeklyBudgetPence: p });
              }
            }}
          />
        </div>
      </Field>
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">The budget covers…</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={value.budgetScope === "planned-meals"} onClick={() => onChange({ budgetScope: "planned-meals" })}>
            Just the planned meals
          </Chip>
          <Chip selected={value.budgetScope === "all-groceries"} onClick={() => onChange({ budgetScope: "all-groceries" })}>
            All my groceries
          </Chip>
        </div>
      </fieldset>
    </div>
  );
}

export function MealsSection({ value, onChange }: SectionProps) {
  const slots: { v: MealSlot; label: string }[] = [
    { v: "breakfast", label: "Breakfast" },
    { v: "lunch", label: "Lunch" },
    { v: "dinner", label: "Dinner" },
  ];
  const meals = value.planDays.length * value.slots.length;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Which meals should we plan?</legend>
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <Chip
              key={s.v}
              selected={value.slots.includes(s.v)}
              onClick={() => {
                const next = toggleIn(value.slots, s.v);
                if (next.length) onChange({ slots: next });
              }}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Which days?</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_SHORT.map((d, i) => (
            <Chip
              key={d}
              selected={value.planDays.includes(i)}
              onClick={() => {
                const next = toggleIn(value.planDays, i).sort();
                if (next.length) onChange({ planDays: next });
              }}
            >
              {d}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          That&apos;s <strong>{meals}</strong> meal{meals === 1 ? "" : "s"} a week. Leave days off for takeaways, eating out or freezer nights.
        </p>
      </fieldset>
    </div>
  );
}

const TIME_OPTIONS = [20, 30, 45, 60, 90, 120];

export function TimeSkillSection({ value, onChange }: SectionProps) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Weeknight cooking time, at most</legend>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.slice(0, 5).map((t) => (
            <Chip key={t} selected={value.weeknightMaxMins === t} onClick={() => onChange({ weeknightMaxMins: t })}>
              {t} min
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Weekends, at most</legend>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.slice(1).map((t) => (
            <Chip key={t} selected={value.weekendMaxMins === t} onClick={() => onChange({ weekendMaxMins: t })}>
              {t >= 120 ? "2 hrs+" : `${t} min`}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Cooking confidence</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["beginner", "Keep it simple"],
              ["confident", "Happy cook"],
              ["keen", "Love a challenge"],
            ] as const
          ).map(([v, l]) => (
            <Chip key={v} selected={value.skill === v} onClick={() => onChange({ skill: v })}>
              {l}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Kitchen equipment you have</legend>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT.map((e) => (
            <Chip key={e} selected={value.equipment.includes(e)} onClick={() => onChange({ equipment: toggleIn(value.equipment, e) })}>
              {EQUIPMENT_LABELS[e]}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function TagInput({ label, values, onChange, placeholder, hint }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; hint?: string }) {
  const id = useId();
  const [text, setText] = useState("");
  const add = () => {
    const parts = text
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    onChange([...new Set([...values, ...parts])]);
    setText("");
  };
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex gap-2">
        <input
          id={id}
          className={inputClass}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={label}>
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="inline-flex min-h-9 items-center gap-1 rounded-full bg-surface-2 px-3 text-sm font-medium"
                aria-label={`Remove ${v}`}
              >
                {v} <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

export function DietSection({ value, onChange }: SectionProps) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Dietary requirements</legend>
        <div className="flex flex-wrap gap-2">
          {DIETS.map((d) => (
            <Chip key={d} selected={value.diets.includes(d)} onClick={() => onChange({ diets: toggleIn(value.diets, d) })}>
              {DIET_LABELS[d]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-[15px] font-semibold">Allergies in your household</legend>
        <p className="mb-2 text-sm text-muted">Recipes containing these – or that commonly “may contain” them – are always excluded.</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <Chip key={a} selected={value.allergens.includes(a)} onClick={() => onChange({ allergens: toggleIn(value.allergens, a) })}>
              {ALLERGEN_LABELS[a]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <TagInput
        label="Other allergies or intolerances"
        placeholder="e.g. kiwi, coconut"
        values={value.allergyTerms}
        onChange={(v) => onChange({ allergyTerms: v })}
        hint="Any recipe with an ingredient matching these words is excluded."
      />
      {(value.allergens.length > 0 || value.allergyTerms.length > 0) && (
        <Notice tone="warn" title="Please double-check labels">
          We exclude recipes based on typical ingredient composition. Brands differ and cross-contamination isn&apos;t
          tracked, so always read product labels and check with your doctor or dietitian for serious allergies.
        </Notice>
      )}
      <TagInput
        label="Ingredients you don't like"
        placeholder="e.g. mushrooms, coriander"
        values={value.dislikes}
        onChange={(v) => onChange({ dislikes: v })}
      />
    </div>
  );
}

export function TastesSection({ value, onChange }: SectionProps) {
  const id = useId();
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Cuisines you enjoy</legend>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => (
            <Chip key={c} selected={value.cuisines.includes(c)} onClick={() => onChange({ cuisines: toggleIn(value.cuisines, c) })}>
              {CUISINE_LABELS[c]}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Pick none to keep things varied.</p>
      </fieldset>
      <Field label="Favourite dishes" htmlFor={id} hint="Separate with commas – e.g. chilli, fish pie, stir-fry">
        <textarea
          id={id}
          rows={2}
          className={`${inputClass} py-3`}
          value={value.favourites}
          onChange={(e) => onChange({ favourites: e.target.value })}
        />
      </Field>
    </div>
  );
}

const PRIORITY_LABELS: Record<keyof Household["priorities"], [string, string]> = {
  health: ["Healthy meals", "More veg-packed, lighter dishes"],
  convenience: ["Convenience", "Quicker, simpler cooking"],
  variety: ["Variety", "Different cuisines and proteins"],
  savings: ["Saving money", "Cheaper meals and less waste"],
};

export function StyleSection({ value, onChange }: SectionProps) {
  return (
    <div className="space-y-5">
      <Toggle
        label="Happy to batch-cook and eat leftovers"
        description="We'll sometimes cook a double batch so a later meal needs no cooking."
        checked={value.batchCooking}
        onChange={(v) => onChange({ batchCooking: v, leftoversPerWeek: v ? Math.max(1, value.leftoversPerWeek) : 0 })}
      />
      {value.batchCooking && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-[15px] font-semibold">Leftover meals per week</p>
          <Stepper label="leftover meals per week" value={value.leftoversPerWeek} min={0} max={4} onChange={(v) => onChange({ leftoversPerWeek: v })} />
        </div>
      )}
      <fieldset className="space-y-4">
        <legend className="mb-1 text-[15px] font-semibold">What matters most?</legend>
        {(Object.keys(PRIORITY_LABELS) as (keyof Household["priorities"])[]).map((k) => (
          <PrioritySlider key={k} label={PRIORITY_LABELS[k][0]} hint={PRIORITY_LABELS[k][1]} value={value.priorities[k]} onChange={(v) => onChange({ priorities: { ...value.priorities, [k]: v } })} />
        ))}
      </fieldset>
    </div>
  );
}

function PrioritySlider({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  const words = ["Not important", "A little", "Important", "Very important"];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <span className="text-sm text-muted">{words[value]}</span>
      </div>
      <p className="text-sm text-muted">{hint}</p>
      <input id={id} type="range" min={0} max={3} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-10 w-full" aria-valuetext={words[value]} />
    </div>
  );
}

export function WeightsSection({ value, onChange }: SectionProps) {
  const set = (k: keyof PlannerWeights, v: number) => onChange({ weights: { ...value.weights, [k]: v } });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Every recipe gets a score from 0–1 on each of these, then a weighted average decides the plan. Allergies, diets,
        dislikes and equipment are strict filters applied first – weights can never override them.
      </p>
      {(Object.keys(CRITERION_LABELS) as (keyof PlannerWeights)[]).map((k) => (
        <WeightSlider key={k} label={CRITERION_LABELS[k]} value={value.weights[k]} onChange={(v) => set(k, v)} />
      ))}
    </div>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <span className="text-sm tabular-nums text-muted">{value.toFixed(1)}</span>
      <input id={id} type="range" min={0} max={5} step={0.5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="col-span-2 h-9 w-full" />
    </div>
  );
}

const STAPLE_CANDIDATES = INGREDIENTS.filter((i) => i.staple || i.category === "Herbs & spices" || ["soy-sauce", "plain-flour", "tomato-puree", "chicken-stock-cube", "beef-stock-cube", "honey", "mayonnaise", "worcestershire-sauce", "garlic"].includes(i.id));

export function StaplesSection({ value, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <Toggle
        label="Skip store-cupboard basics on the bill"
        description="Ticked items still appear on your list under “Check you have”, but aren't counted as shopping."
        checked={value.assumeStaples}
        onChange={(v) => onChange({ assumeStaples: v })}
      />
      {value.assumeStaples && (
        <div className="flex flex-wrap gap-2">
          {STAPLE_CANDIDATES.map((i) => (
            <Chip key={i.id} selected={value.cupboardStaples.includes(i.id)} onClick={() => onChange({ cupboardStaples: toggleIn(value.cupboardStaples, i.id) })}>
              {i.name}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
