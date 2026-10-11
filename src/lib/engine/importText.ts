import type { RecipeIngredient } from "../domain/types";
import { matchIngredient } from "./normalise";
import { KNOWN_UNIT_WORDS, normaliseUnit } from "./units";

/**
 * Parses free-text recipes (pasted by the user) into structured data that the
 * user then reviews. Parsing is heuristic: every parsed line is shown for
 * confirmation and can be edited before saving.
 */

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": " 1/2", "¼": " 1/4", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3", "⅛": " 1/8", "⅕": " 1/5", "⅙": " 1/6",
};

function parseNumberToken(tok: string): number | null {
  if (/^\d+\/\d+$/.test(tok)) {
    const [a, b] = tok.split("/").map(Number);
    return b ? a / b : null;
  }
  if (/^\d*\.?\d+$/.test(tok)) return Number(tok);
  return null;
}

const CONTAINER_WORDS = /^(?:of|x|×|tins?|cans?|packs?|packets?|jars?|bags?|pots?|cartons?|bottles?|tubs?)\s+/i;
const WORD_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5 };

export interface ParsedLine extends RecipeIngredient {
  raw: string;
  matched: boolean;
}

export function parseIngredientLine(rawLine: string): ParsedLine | null {
  let line = rawLine.trim();
  if (!line) return null;
  line = line.replace(/^[-*•·▪◦‣]\s*/, "").replace(/^\d+[.)]\s+(?=\D)/, "");
  for (const [f, r] of Object.entries(UNICODE_FRACTIONS)) line = line.split(f).join(r);
  line = line.replace(/(\d)\s*[-–]\s*(\d)/g, "$1-$2").replace(/\s+/g, " ").trim();

  let note: string | undefined;
  const paren = line.match(/\(([^)]*)\)/);
  if (paren) {
    note = paren[1].trim();
    line = line.replace(paren[0], " ").replace(/\s+/g, " ").trim();
  }

  let quantity = 0;
  let unit = "";
  let rest = line;

  // "2 x 400g tins chopped tomatoes"
  const multi = rest.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b\s*(.*)$/i);
  if (multi) {
    quantity = Number(multi[1]) * Number(multi[2]);
    unit = normaliseUnit(multi[3]);
    rest = multi[4];
  } else {
    // Leading number(s): "1 1/2", "1/2", "2-3", "1.5", "200g"
    const tokens = rest.split(" ");
    let consumed = 0;
    let qty: number | null = null;
    const first = tokens[0] ?? "";
    const attached = first.match(/^(\d+(?:[./]\d+)?)([a-zA-Z]+)$/); // 200g, 1kg, 2tbsp
    if (attached && (KNOWN_UNIT_WORDS.has(attached[2].toLowerCase()) || ["g", "l"].includes(attached[2].toLowerCase()))) {
      qty = parseNumberToken(attached[1]);
      unit = normaliseUnit(attached[2]);
      consumed = 1;
    } else {
      const range = first.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
      if (range) {
        qty = Number(range[1]);
        consumed = 1;
      } else {
        const n1 = parseNumberToken(first);
        if (n1 !== null) {
          qty = n1;
          consumed = 1;
          const n2 = tokens[1] ? parseNumberToken(tokens[1]) : null;
          if (n2 !== null && /\//.test(tokens[1])) {
            qty += n2;
            consumed = 2;
          }
        } else if (WORD_NUMBERS[first.toLowerCase()] !== undefined) {
          qty = WORD_NUMBERS[first.toLowerCase()];
          consumed = 1;
        }
      }
      if (qty !== null && !unit) {
        const next = tokens[consumed] ?? "";
        const nextTwo = `${next} ${tokens[consumed + 1] ?? ""}`.toLowerCase().trim();
        // "200 g", "2 tbsp", "3 cloves"
        if (nextTwo === "fl oz") {
          unit = "floz";
          consumed += 2;
        } else {
          const cleaned = next.toLowerCase().replace(/[.,]$/, "");
          const attachedNext = cleaned.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)$/);
          if (KNOWN_UNIT_WORDS.has(cleaned) || ["g", "l"].includes(cleaned)) {
            unit = normaliseUnit(cleaned);
            consumed += 1;
          } else if (attachedNext && /^(tins?|cans?)$/.test((tokens[consumed + 1] ?? "").toLowerCase())) {
            // "1 400g tin of ..." → 400 g
            qty = qty * Number(attachedNext[1]);
            unit = normaliseUnit(attachedNext[2]);
            consumed += 2;
          } else if (["large", "medium", "small", "whole"].includes(cleaned)) {
            unit = "item";
            consumed += 1;
          }
        }
      }
    }
    if (qty !== null) {
      quantity = qty;
      rest = tokens.slice(consumed).join(" ");
      if (!unit) unit = "item";
    }
  }

  // drop "/ 2lb" alternative measures and container words
  rest = rest.replace(/^\/\s*\S+\s*/, "").replace(CONTAINER_WORDS, "").replace(CONTAINER_WORDS, "").trim();
  const commaIdx = rest.indexOf(",");
  if (commaIdx > 0) {
    const extra = rest.slice(commaIdx + 1).trim();
    note = [extra, note].filter(Boolean).join("; ");
    rest = rest.slice(0, commaIdx).trim();
  }
  const optional = /\boptional\b/i.test(rawLine) || /\bto serve\b/i.test(rawLine);
  rest = rest.replace(/\b(optional|to serve|to taste)\b/gi, "").replace(/\s+/g, " ").trim().replace(/^[,;:\s]+|[,;:\s]+$/g, "");
  if (!rest) return null;

  const ing = matchIngredient(rest);
  return {
    raw: rawLine.trim(),
    ingredientId: ing?.id ?? null,
    name: rest,
    quantity: Math.round(quantity * 1000) / 1000,
    unit: quantity === 0 && !unit ? "" : unit || "item",
    note: note || undefined,
    optional: optional || undefined,
    matched: Boolean(ing),
  };
}

export interface ParsedRecipe {
  name: string;
  servings: number | null;
  prepMins: number | null;
  cookMins: number | null;
  ingredients: ParsedLine[];
  steps: string[];
  warnings: string[];
}

function parseMinutes(s: string): number | null {
  let mins = 0;
  let found = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (h) {
    mins += Number(h[1]) * 60;
    found = true;
  }
  const m = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (m) {
    mins += Number(m[1]);
    found = true;
  }
  return found ? Math.round(mins) : null;
}

const ING_HEADING = /^(ingredients?|you(?:'ll)? need|for the [a-z ]+)\s*:?\s*$/i;
const STEP_HEADING = /^(method|instructions?|directions?|steps?|how to make(?: it)?|preparation)\s*:?\s*$/i;

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const warnings: string[] = [];
  let name = "";
  let servings: number | null = null;
  let prepMins: number | null = null;
  let cookMins: number | null = null;
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let section: "intro" | "ingredients" | "steps" = "intro";

  for (const line of lines) {
    if (!line) continue;
    const lower = line.toLowerCase();
    const serves = lower.match(/^(?:serves|servings|makes|feeds|yield)\s*:?\s*(\d+)/);
    if (serves) {
      servings = Number(serves[1]);
      continue;
    }
    if (/^prep(?:aration)?(?: time)?\s*:?/i.test(line) && parseMinutes(line) !== null) {
      prepMins = parseMinutes(line);
      continue;
    }
    if (/^cook(?:ing)?(?: time)?\s*:?/i.test(line) && parseMinutes(line) !== null) {
      cookMins = parseMinutes(line);
      continue;
    }
    if (/^total(?: time)?\s*:?/i.test(line)) continue;
    if (ING_HEADING.test(line)) {
      section = "ingredients";
      continue;
    }
    if (STEP_HEADING.test(line)) {
      section = "steps";
      continue;
    }
    if (section === "intro") {
      if (!name) {
        name = line.replace(/^#+\s*/, "");
        continue;
      }
      // no headings: guess by shape
      if (/^([-*•]|\d+(\s|[./]|[a-z]+\s))/i.test(line) && !/^\d+[.)]\s+[A-Z]/.test(line)) ingredientLines.push(line);
      else stepLines.push(line);
      continue;
    }
    if (section === "ingredients") ingredientLines.push(line);
    else stepLines.push(line.replace(/^(step\s*)?\d+[.):]?\s*/i, ""));
  }

  const ingredients = ingredientLines.map(parseIngredientLine).filter((x): x is ParsedLine => x !== null);
  const unmatched = ingredients.filter((i) => !i.matched);
  if (!name) warnings.push("No title found – please add one.");
  if (!ingredients.length) warnings.push("No ingredients found. Put each ingredient on its own line, ideally under an “Ingredients” heading.");
  if (!stepLines.length) warnings.push("No method found. Add steps under a “Method” heading.");
  if (unmatched.length)
    warnings.push(
      `${unmatched.length} ingredient${unmatched.length === 1 ? "" : "s"} not recognised (${unmatched.map((u) => u.name).slice(0, 4).join(", ")}). They'll still be added to your shopping list, but allergens and prices can't be checked for them.`,
    );
  if (servings === null) warnings.push("Servings not found – defaulting to 4.");

  return { name, servings, prepMins, cookMins, ingredients, steps: stepLines.filter((s) => s.length > 2), warnings };
}
