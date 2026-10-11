# Pricing

## What the app does now

- **Demonstration prices** (`src/lib/data/ingredients.ts`, `src/lib/pricing/demoProvider.ts`): a hand-estimated baseline pack price per ingredient, adjusted by a rough per-store factor (Aldi/Lidl 0.87, Asda 0.94, Tesco/Morrisons 1.00, Sainsbury's 1.05). Every demo product has `source: "demo"`, `confidence: "low"` and **no** `lastChecked` date. The UI labels them "Demo prices" and shows a ±25 % range.
- **Your prices** (Settings → Prices): shelf/receipt prices you enter, stored with the date you saw them, `confidence: "high"`. For that supermarket and ingredient they replace demo data entirely.
- Totals show the uncertainty range and list ingredients with no price data rather than silently treating them as free.

## Provider interface

`PriceProvider.fetchProducts({ supermarket, ingredientIds })` returns `Product` records (supermarket, product name, brand/own-brand, pack size in the ingredient's base unit, pack price, optional URL, last-checked date, source, confidence). A provider's results are loaded into the `PriceBook`, which the rest of the app already uses (precedence: manual > provider > demo). The pack optimiser then matches recipe needs to real pack sizes and could produce a basket.

## Live data – status and constraints

No live integration is implemented, and the app never claims a price is live or that a basket has been created. UK supermarkets do not offer open public product/price APIs for consumer apps; their websites' terms generally prohibit automated scraping, and their logins and bot protection must not be bypassed. Legitimate routes to explore before building anything:

1. Licensed retail-data providers (commercial price/assortment feeds).
2. Official partner or affiliate programmes offered by a retailer, under their terms.
3. User-contributed prices (already supported locally; could be shared via the `price_observations` table).

Any such integration would implement `PriceProvider`, set `source: "provider"`, record `lastChecked`, and be covered by tests before being described as working.
