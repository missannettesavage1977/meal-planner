# Architecture

## Overview

Plate Planner is a **local-first** Next.js (App Router, React 19, TypeScript, Tailwind v4) PWA. All planning, consolidation and costing runs in the browser from pure TypeScript modules; state is persisted to `localStorage` through a versioned, Zod-validated Zustand store. The only server code is an optional route that calls Claude when an API key is configured.

```
UI (src/app, src/components)
   │  hooks (useWeekData, useRecipes, usePriceBook…)
   ▼
Store (src/lib/store/appStore.ts) ── persist → localStorage ("ukmp-state", version 1, migrate + validate on load)
   │  actions call pure engine functions
   ▼
Engine (src/lib/engine)                Pricing (src/lib/pricing)
  units.ts        unit maths             types.ts       PriceProvider interface, Estimate ranges
  normalise.ts    name → ingredient id   demoProvider.ts illustrative per-store prices
  consolidate.ts  shopping lines         priceBook.ts   precedence manual > provider > demo; pack optimiser
  planner.ts      scoring & editing
  budget.ts       cost/savings
  recipeMeta.ts   allergens/diets
  importText.ts, substitutions.ts, weekRequest.ts, shoppingText.ts
   ▲
Data (src/lib/data): ingredient catalogue (≈120 items) and 48 original recipes
```

## Key design decisions

**Canonical units.** Every catalogue ingredient has a base unit (`g`, `ml` or `item`) plus the data needed for *safe* conversion: typical item weight, density, and ingredient-specific units (tin = 400 g, clove, bunch, rasher…). `toBase()` returns `null` when no safe conversion exists; consolidation then keeps that requirement on a separate line with a warning instead of guessing. Fresh/dried/ground forms are separate ingredients, so they never merge.

**Name normalisation.** Text is lower-cased, accent-stripped and singularised; the longest run of words matching a catalogue name/alias wins (so "red pepper" ≠ "black pepper", "ground coriander" ≠ "fresh coriander"). Unknown ingredients stay free text: they merge only with identically-named lines in the same unit dimension and are flagged as unverifiable for allergens.

**Consolidation pipeline** (`consolidate.ts`): scale each recipe to planned portions → convert to base units → merge → subtract inventory (each unit of food at home is allocated once) → apply manual "owned"/override/staple rules → choose packs (cheapest combination covering the need; ties broken by least surplus) → cost.

**Two kinds of cost.** *Consumption cost* = quantity used × unit price (what the meal "eats"). *Purchase cost* = the packs you must buy. Budget savings are measured on the shopping bill in successive steps so nothing is double-counted: A (each meal bought separately) → B (bought together; overlap saving = A − B) → C (using food at home; inventory saving = B − C).

**Planner.** Hard filters first (allergens incl. "may contain", free-text allergy terms, diets, dislikes, equipment, unverifiable ingredients when allergies are set). Each eligible recipe then gets a 0–1 score per criterion:

| Criterion | How it's measured |
| --- | --- |
| preference | favourite cuisines/dishes, family-friendly for children, leftover-friendly when batch cooking |
| cost | *marginal* shopping cost per portion vs a budget-derived target (shared packs are therefore cheaper) |
| inventory | value of unallocated home food used, plus a bonus for items near their date (never past a use-by) |
| overlap | share of the recipe's perishable ingredients already in the plan |
| waste | change in leftover perishable pack value |
| time | active minutes vs weeknight/weekend limits and skill |
| variety | no repeats; penalises same protein/cuisine on adjacent days or too often |
| health | veg count, "healthy" tag |
| priceConfidence | fraction of ingredients with price data |

The weighted average (weights in Settings, scaled by the household's stated priorities) ranks candidates; a seeded jitter between near-equal options gives variety on regenerate. Slots are filled greedily in date order, then a post-pass converts some meals into planned leftovers (cooking extra of a recipe that keeps long enough). Reasons are recorded per meal and shown in the UI. Editing helpers (`replaceMeal`, `moveMeal`, `removeMeal`, `addLeftover`) only touch the meal concerned and its own leftovers, and report anything they change.

**Budget fitting** greedily makes the single swap of an unlocked, uncooked meal that most reduces the shopping bill, repeating until within budget; each swap is listed.

## Data model (relational, `supabase/migrations`)

| Table | Purpose / ownership |
| --- | --- |
| `supermarkets`, `ingredients`, `ingredient_aliases`, `ingredient_units`, `ingredient_allergens` | Reference data, read-only to users |
| `households` (owner_id), `household_restrictions` | Household settings; diets, allergens, allergy terms, dislikes |
| `recipes` (owner_id null = built-in), `recipe_ingredients`, `recipe_steps`, `recipe_substitutions` | Built-in + user recipes |
| `meal_plans`, `planned_meals` (leftover_of self-FK) | Weekly plans |
| `inventory_items` | My Food |
| `shopping_lists`, `shopping_list_items` | User state on derived lines (ticks/owned/overrides) + ad hoc items |
| `products` (owner_id null = shared), `price_observations` (source, confidence, observed_on) | Provider-independent pricing; demo rows cannot carry a checked date |

RLS: every user-owned table is restricted to the owner via `auth.uid()` (directly or through household/plan/list ownership helper functions); planned meals may only reference recipes the user can read; users may add only `manual` price observations of their own. `tests/unit/rls.test.ts` applies the real migration to an in-process Postgres (PGlite) and checks isolation between two users and anonymous access. The browser store mirrors this model in denormalised form (`src/lib/domain/types.ts`).

## Secrets

`ANTHROPIC_API_KEY` is read only in the server route. No privileged credentials are used in client code. The future Supabase service-role key must never be exposed with a `NEXT_PUBLIC_` prefix.

## Known limitations

- Prices are demonstration data unless you enter your own; no live retailer integration.
- Cloud sync/auth is designed (schema + RLS) but not wired into the UI; data lives in one browser (use backup/restore to move it).
- Nutrition is not displayed (no verified data).
- Allergen data is ingredient-level and typical, not product-specific.
- The planner is greedy (fast, explainable) rather than globally optimal.
- Recipe images are emoji illustrations.
- Ingredient matching is heuristic; unmatched imported ingredients are kept as free text and flagged.
