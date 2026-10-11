"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Check, FileText, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Hydrated } from "@/components/Hydrated";
import { toast } from "@/components/toast";
import { Badge, Button, Card, Chip, Field, Notice, PageHeader, Stepper, Toggle, inputClass } from "@/components/ui";
import { CUISINES, CUISINE_LABELS, EQUIPMENT, EQUIPMENT_LABELS, RecipeSchema, type Equipment, type MealSlot, type Recipe } from "@/lib/domain/types";
import { parseIngredientLine, parseRecipeText } from "@/lib/engine/importText";
import { matchIngredient } from "@/lib/engine/normalise";
import { useAppStore } from "@/lib/store/appStore";
import { useRecipes } from "@/lib/store/hooks";
import { newId } from "@/lib/utils/ids";

export default function NewRecipePage() {
  return (
    <Hydrated>
      <Suspense>
        <Editor />
      </Suspense>
    </Hydrated>
  );
}

interface Row {
  key: string;
  quantity: string;
  unit: string;
  name: string;
  note: string;
  optional: boolean;
}

const EMOJIS = ["🍲", "🍝", "🥘", "🍛", "🥗", "🌮", "🍜", "🥧", "🍳", "🥪", "🍗", "🐟", "🥦", "🍕", "🥣", "🍰"];
const TAGS = ["family-friendly", "batch-cook", "budget", "healthy", "comfort", "one-pot", "use-it-up"];
const UNITS = ["", "g", "kg", "ml", "l", "tsp", "tbsp", "item", "clove", "tin", "pinch", "bunch", "handful", "slice", "cube", "stick"];

const toRow = (i: { quantity: number; unit: string; name: string; note?: string; optional?: boolean }): Row => ({
  key: newId("row"),
  quantity: i.quantity ? String(i.quantity) : "",
  unit: i.unit,
  name: i.name,
  note: i.note ?? "",
  optional: Boolean(i.optional),
});

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const { byId } = useRecipes();
  const saveRecipe = useAppStore((s) => s.saveRecipe);
  const editing = params.get("edit") ? byId[params.get("edit")!] : undefined;
  const [mode, setMode] = useState<"write" | "import">(params.get("mode") === "import" && !editing ? "import" : "write");
  const [pasted, setPasted] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [source, setSource] = useState<Recipe["source"]>(editing?.source ?? "user");

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [cuisine, setCuisine] = useState<Recipe["cuisine"]>(editing?.cuisine ?? "other");
  const [mealTypes, setMealTypes] = useState<MealSlot[]>(editing?.mealTypes ?? ["dinner"]);
  const [servings, setServings] = useState(editing?.servings ?? 4);
  const [prep, setPrep] = useState(String(editing?.prepMins ?? 15));
  const [cook, setCook] = useState(String(editing?.cookMins ?? 30));
  const [rows, setRows] = useState<Row[]>(editing ? editing.ingredients.map(toRow) : [toRow({ quantity: 0, unit: "", name: "" })]);
  const [steps, setSteps] = useState(editing?.steps.join("\n") ?? "");
  const [storage, setStorage] = useState(editing?.storage ?? "");
  const [keepsDays, setKeepsDays] = useState(editing?.keepsDays ?? 0);
  const [freezable, setFreezable] = useState(editing?.freezable ?? false);
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [equipment, setEquipment] = useState<Equipment[]>(editing?.equipment ?? ["hob"]);
  const [emoji, setEmoji] = useState(editing?.emoji ?? "🍲");
  const [errors, setErrors] = useState<string[]>([]);

  const runImport = () => {
    const r = parseRecipeText(pasted);
    if (r.name) setName(r.name);
    if (r.servings) setServings(r.servings);
    if (r.prepMins !== null) setPrep(String(r.prepMins));
    if (r.cookMins !== null) setCook(String(r.cookMins));
    if (r.ingredients.length) setRows(r.ingredients.map(toRow));
    if (r.steps.length) setSteps(r.steps.join("\n"));
    setImportWarnings(r.warnings);
    setSource("imported");
    setMode("write");
    toast("Recipe read – please check everything below before saving", "info");
  };

  const updateRow = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    const ingredients = rows
      .filter((r) => r.name.trim())
      .map((r) => {
        const ing = matchIngredient(r.name);
        return {
          ingredientId: ing?.id ?? null,
          name: r.name.trim(),
          quantity: Number(r.quantity) || 0,
          unit: r.unit || (Number(r.quantity) ? "item" : ""),
          note: r.note.trim() || undefined,
          optional: r.optional || undefined,
        };
      });
    const candidate = {
      id: editing?.id ?? newId("recipe"),
      name: name.trim(),
      description: description.trim(),
      cuisine,
      mealTypes,
      servings,
      prepMins: Number(prep) || 0,
      cookMins: Number(cook) || 0,
      ingredients,
      steps: steps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      storage: storage.trim() || undefined,
      keepsDays,
      freezable,
      substitutions: editing?.substitutions ?? [],
      tags,
      equipment,
      difficulty: editing?.difficulty ?? "easy",
      emoji,
      hue: editing?.hue ?? Math.floor(Math.random() * 360),
      source,
    };
    const parsed = RecipeSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    saveRecipe(parsed.data);
    toast(editing ? "Recipe updated" : "Recipe saved");
    router.push(`/recipes/${parsed.data.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={() => router.back()} className="mb-3 inline-flex min-h-10 items-center gap-1 text-[15px] font-semibold text-muted hover:text-text">
        <ArrowLeft size={18} aria-hidden /> Back
      </button>
      <PageHeader title={editing ? "Edit recipe" : "New recipe"} subtitle="Your recipes are stored on this device and can be planned like any other." />

      {!editing && (
        <div className="mb-4 flex gap-2" role="tablist">
          <Chip selected={mode === "write"} onClick={() => setMode("write")}>
            Write it
          </Chip>
          <Chip selected={mode === "import"} onClick={() => setMode("import")}>
            <FileText size={16} aria-hidden /> Paste & import
          </Chip>
        </div>
      )}

      {mode === "import" ? (
        <Card>
          <Field label="Paste a recipe" htmlFor="paste" hint="Include the title, servings, an “Ingredients” list (one per line) and the “Method”. Only import recipes you have the right to use.">
            <textarea
              id="paste"
              rows={14}
              className={`${inputClass} py-3 font-mono text-sm`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"Lemony chickpea stew\nServes 4\nPrep: 10 mins\nCook: 25 mins\n\nIngredients\n1 onion, chopped\n2 x 400g tins chickpeas\n...\n\nMethod\n1. Fry the onion...\n"}
            />
          </Field>
          <Button className="mt-4" onClick={runImport} disabled={!pasted.trim()}>
            Read recipe
          </Button>
          <p className="mt-3 text-sm text-muted">Importing from a website link isn&apos;t supported – copy the text instead, so you stay in control of what&apos;s saved.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {errors.length > 0 && (
            <Notice tone="danger" title="Please fix these">
              <ul className="list-disc pl-5">
                {[...new Set(errors)].map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Notice>
          )}
          {importWarnings.length > 0 && (
            <Notice tone="warn" title="Check the imported recipe">
              <ul className="list-disc pl-5">
                {importWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Notice>
          )}

          <Card className="space-y-4">
            <Field label="Recipe name" htmlFor="r-name">
              <input id="r-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nan's cottage pie" />
            </Field>
            <Field label="Short description" htmlFor="r-desc">
              <input id="r-desc" className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prep (mins)" htmlFor="r-prep">
                <input id="r-prep" inputMode="numeric" className={inputClass} value={prep} onChange={(e) => setPrep(e.target.value)} />
              </Field>
              <Field label="Cook (mins)" htmlFor="r-cook">
                <input id="r-cook" inputMode="numeric" className={inputClass} value={cook} onChange={(e) => setCook(e.target.value)} />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Serves</span>
              <Stepper label="servings" value={servings} min={1} max={24} onChange={setServings} />
            </div>
            <fieldset>
              <legend className="mb-2 font-semibold">Good for</legend>
              <div className="flex flex-wrap gap-2">
                {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((m) => (
                  <Chip key={m} selected={mealTypes.includes(m)} onClick={() => setMealTypes(mealTypes.includes(m) ? mealTypes.filter((x) => x !== m) : [...mealTypes, m])} className="capitalize">
                    {m}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <Field label="Cuisine" htmlFor="r-cuisine">
              <select id="r-cuisine" className={inputClass} value={cuisine} onChange={(e) => setCuisine(e.target.value as Recipe["cuisine"])}>
                <option value="other">Other / mixed</option>
                {CUISINES.map((c) => (
                  <option key={c} value={c}>
                    {CUISINE_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-2 font-semibold">Picture</legend>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" aria-pressed={emoji === e} aria-label={`Use ${e}`} onClick={() => setEmoji(e)} className={`grid h-11 w-11 place-items-center rounded-xl text-2xl ${emoji === e ? "bg-primary-soft ring-2 ring-primary" : "hover:bg-surface-2"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card>
            <h2 className="mb-1 text-lg font-bold">Ingredients</h2>
            <p className="mb-3 text-sm text-muted">
              Recognised ingredients get allergen checks, price estimates and merge on your shopping list. Unrecognised ones are still listed.
            </p>
            <ul className="space-y-3">
              {rows.map((r) => {
                const match = r.name.trim() ? matchIngredient(r.name) : null;
                return (
                  <li key={r.key} className="rounded-2xl border border-border p-3">
                    <div className="grid grid-cols-[5rem_6.5rem_1fr] gap-2">
                      <input aria-label="Quantity" inputMode="decimal" className={inputClass} placeholder="Qty" value={r.quantity} onChange={(e) => updateRow(r.key, { quantity: e.target.value })} />
                      <select aria-label="Unit" className={inputClass} value={UNITS.includes(r.unit) ? r.unit : "__custom"} onChange={(e) => updateRow(r.key, { unit: e.target.value === "__custom" ? r.unit : e.target.value })}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u || "—"}
                          </option>
                        ))}
                        {!UNITS.includes(r.unit) && <option value="__custom">{r.unit}</option>}
                      </select>
                      <input aria-label="Ingredient" className={inputClass} placeholder="Ingredient" value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value })} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {r.name.trim() &&
                        (match ? (
                          <Badge tone="green">
                            <Check size={12} aria-hidden /> {match.name}
                          </Badge>
                        ) : (
                          <Badge tone="warn">
                            <TriangleAlert size={12} aria-hidden /> Not recognised
                          </Badge>
                        ))}
                      <input aria-label="Note" className="min-h-10 flex-1 rounded-lg border border-border bg-surface px-2 text-sm" placeholder="Note (e.g. chopped)" value={r.note} onChange={(e) => updateRow(r.key, { note: e.target.value })} />
                      <label className="flex min-h-10 items-center gap-1.5 text-sm">
                        <input type="checkbox" className="h-5 w-5" checked={r.optional} onChange={(e) => updateRow(r.key, { optional: e.target.checked })} /> Optional
                      </label>
                      <button type="button" aria-label="Remove ingredient" className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setRows([...rows, toRow({ quantity: 0, unit: "", name: "" })])}>
                Add ingredient
              </Button>
              <BulkAdd onAdd={(lines) => setRows([...rows.filter((r) => r.name.trim()), ...lines])} />
            </div>
          </Card>

          <Card className="space-y-4">
            <Field label="Method" htmlFor="r-steps" hint="One step per line.">
              <textarea id="r-steps" rows={8} className={`${inputClass} py-3`} value={steps} onChange={(e) => setSteps(e.target.value)} />
            </Field>
            <Field label="Storage & leftovers (optional)" htmlFor="r-storage">
              <textarea id="r-storage" rows={2} className={`${inputClass} py-3`} value={storage} onChange={(e) => setStorage(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Keeps in the fridge (days)</p>
                <p className="text-sm text-muted">0 means eat fresh – no planned leftovers</p>
              </div>
              <Stepper label="days it keeps" value={keepsDays} min={0} max={5} onChange={setKeepsDays} />
            </div>
            <Toggle label="Freezes well" checked={freezable} onChange={setFreezable} />
            <fieldset>
              <legend className="mb-2 font-semibold">Equipment needed</legend>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((e) => (
                  <Chip key={e} selected={equipment.includes(e)} onClick={() => setEquipment(equipment.includes(e) ? equipment.filter((x) => x !== e) : [...equipment, e])}>
                    {EQUIPMENT_LABELS[e]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 font-semibold">Tags</legend>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <Chip key={t} selected={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>
                    {t}
                  </Chip>
                ))}
              </div>
            </fieldset>
          </Card>

          <div className="sticky bottom-20 z-10 flex gap-2 md:bottom-4">
            <Button size="lg" className="flex-1 shadow-lg" onClick={save}>
              {editing ? "Save changes" : "Save recipe"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkAdd({ onAdd }: { onAdd: (rows: Row[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Paste a list
      </Button>
    );
  return (
    <div className="w-full space-y-2">
      <textarea aria-label="Ingredient lines" rows={5} className={`${inputClass} py-3`} placeholder={"200g rice\n1 onion, chopped\n2 tbsp soy sauce"} value={text} onChange={(e) => setText(e.target.value)} />
      <Button
        variant="secondary"
        onClick={() => {
          const parsed = text
            .split("\n")
            .map(parseIngredientLine)
            .filter((x): x is NonNullable<typeof x> => x !== null);
          onAdd(parsed.map(toRow));
          setText("");
          setOpen(false);
        }}
      >
        Add {text.split("\n").filter((l) => l.trim()).length} lines
      </Button>
    </div>
  );
}
