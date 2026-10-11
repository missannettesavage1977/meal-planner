# Plate Planner – UK smart meal planner

A mobile-first, installable web app (PWA) that helps a UK household plan the week's meals, use up food already at home, and shop from one consolidated list with transparent cost estimates. No subscription, no supermarket account, no server needed – your data stays in your browser.

## What works today

| Area | Status |
| --- | --- |
| Onboarding & household profile (size, portions, supermarket, budget & scope, meals/days, time, skill, equipment, diets, 14 UK allergens + free-text allergies, dislikes, cuisines, favourites, batch cooking, priorities) – every step skippable, all editable in Settings | ✅ Full |
| Weekly planner: generate a week or chosen days, lock, swap (ranked alternatives with reasons), regenerate one meal, move/swap days, servings, mark cooked (updates My Food), planned leftovers, per-meal ingredient substitutions, reuse a previous week, fit-to-budget | ✅ Full |
| Planning engine: transparent weighted scoring (tastes, marginal cost, food at home, expiring items, shared fresh ingredients, pack waste, time, variety, health, price-data quality) with configurable weights; allergies/diets/dislikes/equipment are hard filters | ✅ Full |
| Recipe library: 48 original recipes, search by name or ingredient, filters (meal, diet, time, cost, cuisine, suitability, favourites), detail page with scaling, cost, derived allergens + caveat, storage, substitutions | ✅ Full |
| Create recipes; import from pasted text with line-by-line review | ✅ Full |
| Shopping list: consolidation with safe unit conversion, inventory subtraction, pack rounding, consumption vs purchase cost, aisles, recipe usage, tick off, ad-hoc items, edit quantities, "already have", "always have", shopping mode, share/copy as text, move bought items into My Food | ✅ Full |
| My Food (cupboard/fridge/freezer) with optional amounts, use-by vs best-before guidance, "Use what I have" | ✅ Full |
| Budget: still-to-buy (with range), food value used, per portion, savings from shared packs and from food at home (not double-counted), leftover pack value, biggest costs | ✅ Full |
| Persistence (localStorage, versioned, validated), backup/restore JSON, offline app shell (service worker), installable on Android | ✅ Full |
| "Anything special this week?" natural-language tweaks | ✅ On-device rules; uses Claude if `ANTHROPIC_API_KEY` is set |
| Prices | ⚠️ **Demonstration data** – hand-estimated, never checked against a retailer, labelled everywhere. Your own manual prices override them. |
| Supabase schema, RLS policies, seed data | ✅ Written and tested (in-process Postgres); **cloud sync/auth not wired into the UI** |
| Live supermarket prices / basket creation | ❌ Not implemented – see [docs/PRICING.md](docs/PRICING.md) |
| Nutrition | Deliberately not shown (no verified data) |
| Recipe import from a URL | Not implemented – paste the text instead |

## Quick start

Requires Node.js 20.9+ (tested on 22).

```bash
npm install
npm run dev            # http://localhost:3000
```

Optional: `cp .env.example .env.local` and set `ANTHROPIC_API_KEY` to enable AI interpretation of weekly requests.

### Checks

```bash
npm run typecheck
npm run lint
npm test               # 86 unit tests: maths, planner, parsing, store, RLS (PGlite)
npm run build
npm run test:e2e       # Playwright, Pixel 7 emulation; builds must exist (npm run build) – starts `next start` on :3100
```

Playwright is pinned to 1.56.1. If your browsers differ, run `npx playwright install chromium` (not needed where Chromium is pre-provisioned).

### Use it on your Android phone

1. Deploy (below) – PWAs need HTTPS.
2. Open the URL in Chrome → menu → **Add to Home screen / Install app**.
3. It opens full-screen, works offline once loaded, and keeps data on the phone. Use **Settings → Your data → Download backup** occasionally.

## Deploying (free/cheap)

The app is a standard Next.js app with one optional server route (`/api/ai/week-request`).

- **Vercel (Hobby, free for personal use):** import the repo, framework preset Next.js, no env vars required. Add `ANTHROPIC_API_KEY` only if you want the AI feature.
- **Netlify / Cloudflare Pages / Render / any Node host:** `npm ci && npm run build && npm start` (set `PORT` as needed).
- **Self-host:** `npm run build && PORT=3000 npm start` behind any HTTPS reverse proxy.

There is no database to run. Supabase (free tier) is only needed if you later wire up cloud sync:

```bash
supabase init            # if starting a new Supabase project locally
supabase db reset        # applies supabase/migrations and supabase/seed.sql
npm run db:seed-sql      # regenerate seed.sql after editing recipes/ingredients
```

## Project layout

```
src/app/                 Pages (Home, Meal Plan, Recipes, Shopping List, My Food, Settings, onboarding) + AI route
src/components/          UI primitives, plan components, forms
src/lib/domain/types.ts  Zod schemas and domain types
src/lib/data/            Ingredient catalogue (+ demo prices) and original recipes
src/lib/engine/          Units, name normalisation, consolidation, planner, budget, import, substitutions
src/lib/pricing/         Price provider interface, demo provider, price book & pack optimiser
src/lib/store/           Persisted Zustand store and React hooks
supabase/                Migration (schema + RLS) and generated seed
tests/unit, tests/e2e    Vitest and Playwright tests
docs/                    Architecture, data model, pricing notes
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/PRICING.md](docs/PRICING.md)

## Important caveats

- **Allergens** are derived from typical ingredient composition (including "may contain" for things like curry paste and stock cubes) and are strict exclusions. Brands vary and cross-contamination isn't modelled – always read labels.
- **Prices** are estimates. Built-in figures are illustrative demonstration data, not live prices.
- **Food safety:** use-by dates are about safety, best-before about quality; the app explains the difference and never declares food unsafe from a missing date.
