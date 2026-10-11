import { INGREDIENTS } from "../data/ingredients";
import type { IngredientDef } from "../domain/types";

/**
 * Ingredient name normalisation: maps free text ("2 large Red Peppers, sliced")
 * to a stable catalogue id ("bell-pepper").
 *
 * Strategy: clean and singularise the text, then look for the longest run of
 * words that matches a catalogue name or alias. Form words such as "dried",
 * "fresh", "ground" and "frozen" are kept, so dried and fresh herbs stay distinct.
 */

const IRREGULAR: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  halves: "half",
  knives: "knife",
  chillies: "chilli",
  chilies: "chilli",
  chiles: "chilli",
  potatoes: "potato",
  tomatoes: "tomato",
  mangoes: "mango",
  avocados: "avocado",
  anchovies: "anchovy",
  cloves: "clove",
  olives: "olive",
  chives: "chive",
  noodles: "noodle",
  peas: "pea",
  oats: "oat",
  berries: "berry",
  cherries: "cherry",
  radishes: "radish",
  dishes: "dish",
  sandwiches: "sandwich",
  peaches: "peach",
};

const INVARIANT = new Set([
  "hummus", "houmous", "humous", "couscous", "asparagus", "molasses", "swiss", "cress", "grass",
  "glass", "series", "species", "harissa", "salsa", "feta", "pesto", "mayonnaise",
  "brussels", "herbes", "polenta", "pasta", "gravy",
]);

export function singularise(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (INVARIANT.has(w)) return w;
  if (/(ss|us|is)$/.test(w)) return w;
  if (/ies$/.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (/oes$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Preparation and size words that don't change which ingredient it is. */
const NOISE_WORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "for", "into", "in", "with", "plus", "about", "approx",
  "approximately", "some", "few", "good", "extra", "optional", "taste", "serve", "serving", "garnish",
  "large", "small", "medium", "big", "little-ish", "heaped", "level", "rounded", "generous", "scant",
  "chopped", "finely", "roughly", "thinly", "thickly", "diced", "sliced", "minced", "crushed", "grated",
  "peeled", "deseeded", "seeded", "trimmed", "halved", "quartered", "cubed", "shredded", "torn", "picked",
  "drained", "rinsed", "washed", "beaten", "lightly", "softened", "melted", "cooked", "uncooked", "raw",
  "boiling", "hot", "cold", "warm", "room", "temperature", "zest", "zested", "juiced", "juice",
  "cut", "chunk", "chunks", "wedge", "wedges", "piece", "pieces", "bite-sized", "bite", "sized", "thin",
  "thick", "strips", "strip", "ring", "rings", "roughly-chopped", "finely-chopped", "leftover", "spare",
  "ripe", "mashed", "crumbled", "skinless", "boneless", "organic", "british", "free-range",
]);

/** Normalise free text into a cleaned, singularised token list. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: crème → creme
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s]+/)
    .filter(Boolean)
    .map(singularise);
}

export function normaliseName(text: string): string {
  return tokenise(text).join(" ");
}

interface IndexEntry {
  id: string;
  tokens: number;
}

let index: Map<string, IndexEntry> | null = null;

function buildIndex(): Map<string, IndexEntry> {
  const map = new Map<string, IndexEntry>();
  const add = (phrase: string, id: string) => {
    const key = normaliseName(phrase);
    if (!key) return;
    // first registration wins (catalogue order); names beat aliases because they are added first
    if (!map.has(key)) map.set(key, { id, tokens: key.split(" ").length });
  };
  for (const ing of INGREDIENTS) add(ing.name, ing.id);
  for (const ing of INGREDIENTS) {
    if (ing.plural) add(ing.plural, ing.id);
    for (const a of ing.aliases) add(a, ing.id);
    add(ing.id.replace(/-/g, " "), ing.id);
  }
  return map;
}

function getIndex() {
  if (!index) index = buildIndex();
  return index;
}

/**
 * Finds the catalogue ingredient that best matches free text.
 * Returns null rather than guessing when nothing matches.
 */
export function matchIngredient(text: string): IngredientDef | null {
  const idx = getIndex();
  const all = tokenise(text);
  const tokens = all.filter((t) => !NOISE_WORDS.has(t));
  for (const candidateTokens of [all, tokens]) {
    if (!candidateTokens.length) continue;
    const exact = idx.get(candidateTokens.join(" "));
    if (exact) return INGREDIENTS.find((i) => i.id === exact.id) ?? null;
  }
  // Longest sub-phrase match (prefer more words, then earliest position).
  for (let len = Math.min(tokens.length, 5); len >= 1; len--) {
    for (let start = 0; start + len <= tokens.length; start++) {
      const phrase = tokens.slice(start, start + len).join(" ");
      const hit = idx.get(phrase);
      if (hit) return INGREDIENTS.find((i) => i.id === hit.id) ?? null;
    }
  }
  return null;
}

/** Key used to group free-text ingredients that have no catalogue id. */
export function freeTextKey(name: string): string {
  // Anything after a comma is preparation ("tahini, stirred").
  const main = name.split(",")[0];
  const tokens = tokenise(main).filter((t) => !NOISE_WORDS.has(t));
  return tokens.join(" ") || normaliseName(main);
}
