import { z } from "zod";
import { CUISINES, CUISINE_LABELS, CuisineSchema, DietSchema, type Cuisine, type Diet, type Household } from "../domain/types";

/**
 * "What do you fancy this week?" – a short natural-language request that tweaks
 * one generation of the plan. Parsed deterministically on the device; an AI
 * model can optionally produce the same structure (see /api/ai/week-request).
 * Either way the result is shown to the user before it's applied, and it can
 * only *add* restrictions – it never removes an allergy or diet.
 */
export const WeekRequestSchema = z.object({
  cuisines: z.array(CuisineSchema),
  diets: z.array(DietSchema),
  avoid: z.array(z.string()),
  include: z.array(z.string()),
  maxWeeknightMins: z.number().int().min(10).max(240).nullable(),
  saveMoney: z.boolean(),
  moreLeftovers: z.boolean(),
});
export type WeekRequest = z.infer<typeof WeekRequestSchema>;

const EMPTY: WeekRequest = { cuisines: [], diets: [], avoid: [], include: [], maxWeeknightMins: null, saveMoney: false, moreLeftovers: false };

const CUISINE_WORDS: Record<string, Cuisine> = {
  curry: "indian", curries: "indian", indian: "indian", italian: "italian", pasta: "italian", mexican: "mexican",
  tacos: "mexican", chinese: "chinese", "stir-fry": "chinese", "stir fry": "chinese", thai: "thai", british: "british",
  "middle eastern": "middle-eastern", caribbean: "caribbean", spanish: "spanish", moroccan: "moroccan", american: "american",
};

export function parseWeekRequestLocally(text: string): WeekRequest {
  const t = ` ${text.toLowerCase().replace(/[.;!?]/g, ",")} `;
  const r: WeekRequest = structuredClone(EMPTY);
  for (const [w, c] of Object.entries(CUISINE_WORDS)) if (new RegExp(`\\b${w}\\b`).test(t) && !r.cuisines.includes(c)) r.cuisines.push(c);
  const diet = (d: Diet) => !r.diets.includes(d) && r.diets.push(d);
  if (/\b(veggie|vegetarian|meat[- ]free|no meat)\b/.test(t)) diet("vegetarian");
  if (/\bvegan\b/.test(t)) diet("vegan");
  if (/\b(pescatarian|fish but no meat)\b/.test(t)) diet("pescatarian");
  if (/\b(gluten[- ]free|no gluten)\b/.test(t)) diet("gluten-free");
  if (/\b(dairy[- ]free|no dairy)\b/.test(t)) diet("dairy-free");
  for (const m of t.matchAll(/\b(?:no|without|avoid|not|skip|hold the)\s+([a-z][a-z ]{1,24}?)(?=,| and | or |\s*$)/g)) {
    const term = m[1].trim();
    if (term && !["meat", "gluten", "dairy", "more than", "too"].some((x) => term.startsWith(x))) r.avoid.push(term);
  }
  for (const m of t.matchAll(/\b(?:with|use up|using|more|lots of|some)\s+([a-z][a-z ]{1,24}?)(?=,| and | or |\s*$)/g)) {
    const term = m[1].trim();
    if (term && !/^(leftovers?|time|veg(etables)?)$/.test(term)) r.include.push(term);
  }
  const mins = t.match(/(?:under|less than|max(?:imum)?|within|<)\s*(\d{2,3})\s*(?:min|mins|minutes)/);
  if (mins) r.maxWeeknightMins = Number(mins[1]);
  else if (/\b(quick|fast|busy|easy weeknight)/.test(t)) r.maxWeeknightMins = 30;
  r.saveMoney = /\b(cheap|budget|save money|saving|thrifty|frugal|low cost|skint)\b/.test(t);
  r.moreLeftovers = /\b(leftovers|batch|double up|cook once)\b/.test(t);
  return r;
}

export function describeWeekRequest(r: WeekRequest): string[] {
  const out: string[] = [];
  if (r.diets.length) out.push(r.diets.join(", "));
  if (r.cuisines.length) out.push(`more ${r.cuisines.map((c) => CUISINE_LABELS[c]).join(" / ")}`);
  if (r.include.length) out.push(`with ${r.include.join(", ")}`);
  if (r.avoid.length) out.push(`no ${r.avoid.join(", ")}`);
  if (r.maxWeeknightMins) out.push(`weeknights ≤ ${r.maxWeeknightMins} min`);
  if (r.saveMoney) out.push("extra thrifty");
  if (r.moreLeftovers) out.push("more leftovers");
  return out;
}

/** Applies a request on top of the household for one generation. Never relaxes safety settings. */
export function applyWeekRequest(h: Household, r: WeekRequest): Household {
  return {
    ...h,
    diets: [...new Set([...h.diets, ...r.diets])],
    dislikes: [...new Set([...h.dislikes, ...r.avoid])],
    cuisines: r.cuisines.length ? r.cuisines.filter((c) => (CUISINES as readonly string[]).includes(c)) : h.cuisines,
    favourites: [h.favourites, ...r.include].filter(Boolean).join(", "),
    weeknightMaxMins: r.maxWeeknightMins ? Math.min(h.weeknightMaxMins, r.maxWeeknightMins) : h.weeknightMaxMins,
    priorities: r.saveMoney ? { ...h.priorities, savings: 3 } : h.priorities,
    batchCooking: h.batchCooking || r.moreLeftovers,
    leftoversPerWeek: r.moreLeftovers ? Math.max(2, h.leftoversPerWeek) : h.leftoversPerWeek,
  };
}
