import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * User data isolation: applies the real Supabase migration to an in-process
 * Postgres (PGlite) with a minimal stand-in for Supabase's `auth` schema, then
 * checks row-level security as two different signed-in users.
 */

const ALICE = "00000000-0000-4000-8000-00000000a11c";
const BOB = "00000000-0000-4000-8000-000000000b0b";

const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);`);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

const rows = async (sql: string) => (await db.query(sql)).rows as Record<string, unknown>[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  // Reference data and two users (as the service role / superuser).
  await db.exec(`
    insert into auth.users values ('${ALICE}'), ('${BOB}');
    insert into public.supermarkets values ('tesco', 'Tesco');
    insert into public.ingredients (id, name, category, base_unit, diet_level, shelf_life_days) values ('onion', 'onion', 'Fruit & veg', 'item', 'vegan', 30);
    insert into public.recipes (id, owner_id, name, meal_types, servings, prep_mins, cook_mins, source)
      values ('builtin-soup', null, 'Built-in soup', '{dinner}', 4, 10, 20, 'original');
    insert into public.products (id, owner_id, supermarket_id, ingredient_id, name, pack_size, pack_label)
      values ('demo-onion', null, 'tesco', 'onion', 'Onions', 1, 'loose');
    insert into public.price_observations (product_id, owner_id, price_pence, source, confidence) values ('demo-onion', null, 18, 'demo', 'low');
  `);

  // Alice creates her own data through RLS.
  await as(ALICE, async () => {
    await db.exec(`
      insert into public.households (id, owner_id, name) values ('11111111-1111-4111-8111-111111111111', '${ALICE}', 'Alice home');
      insert into public.inventory_items (household_id, name, quantity, unit, location) values ('11111111-1111-4111-8111-111111111111', 'rice', 500, 'g', 'cupboard');
      insert into public.meal_plans (id, household_id, week_start) values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '2026-10-12');
      insert into public.recipes (id, owner_id, name, meal_types, servings, prep_mins, cook_mins) values ('alice-secret-curry', '${ALICE}', 'Alice secret curry', '{dinner}', 2, 5, 5);
      insert into public.planned_meals (meal_plan_id, meal_date, slot, recipe_id, servings) values ('22222222-2222-4222-8222-222222222222', '2026-10-12', 'dinner', 'alice-secret-curry', 2);
      insert into public.shopping_lists (id, household_id, week_start) values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '2026-10-12');
      insert into public.shopping_list_items (shopping_list_id, line_key, checked) values ('33333333-3333-4333-8333-333333333333', 'onion', true);
    `);
  });
  await as(BOB, async () => {
    await db.exec(`insert into public.households (id, owner_id, name) values ('44444444-4444-4444-8444-444444444444', '${BOB}', 'Bob home');`);
  });
}, 60_000);

describe("row-level security – user data isolation", () => {
  it("lets a user see only their own household and its data", async () => {
    await as(ALICE, async () => {
      expect((await rows("select name from public.households")).map((r) => r.name)).toEqual(["Alice home"]);
      expect(await rows("select * from public.inventory_items")).toHaveLength(1);
      expect(await rows("select * from public.planned_meals")).toHaveLength(1);
    });
    await as(BOB, async () => {
      expect((await rows("select name from public.households")).map((r) => r.name)).toEqual(["Bob home"]);
      expect(await rows("select * from public.inventory_items")).toHaveLength(0);
      expect(await rows("select * from public.meal_plans")).toHaveLength(0);
      expect(await rows("select * from public.planned_meals")).toHaveLength(0);
      expect(await rows("select * from public.shopping_list_items")).toHaveLength(0);
    });
  });

  it("hides other users' recipes but shares built-in ones", async () => {
    await as(BOB, async () => {
      const ids = (await rows("select id from public.recipes order by id")).map((r) => r.id);
      expect(ids).toEqual(["builtin-soup"]);
    });
    await as(ALICE, async () => {
      const ids = (await rows("select id from public.recipes order by id")).map((r) => r.id);
      expect(ids).toEqual(["alice-secret-curry", "builtin-soup"]);
    });
  });

  it("prevents writing into another user's household", async () => {
    await as(BOB, async () => {
      await expect(
        db.exec(`insert into public.inventory_items (household_id, name, quantity, unit, location) values ('11111111-1111-4111-8111-111111111111', 'sneaky', 1, 'g', 'fridge')`),
      ).rejects.toThrow(/row-level security/);
      await expect(db.exec(`insert into public.households (owner_id, name) values ('${ALICE}', 'fake')`)).rejects.toThrow(/row-level security/);
      // Updates/deletes against invisible rows silently affect nothing.
      await db.exec(`update public.inventory_items set quantity = 0`);
      await db.exec(`delete from public.households where name = 'Alice home'`);
    });
    await as(ALICE, async () => {
      expect(Number((await rows("select quantity from public.inventory_items"))[0].quantity)).toBe(500);
      expect(await rows("select * from public.households")).toHaveLength(1);
    });
  });

  it("stops a user planning another user's private recipe", async () => {
    await as(BOB, async () => {
      await db.exec(`insert into public.meal_plans (id, household_id, week_start) values ('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', '2026-10-12')`);
      await expect(
        db.exec(`insert into public.planned_meals (meal_plan_id, meal_date, slot, recipe_id, servings) values ('55555555-5555-4555-8555-555555555555', '2026-10-12', 'dinner', 'alice-secret-curry', 2)`),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("keeps reference data read-only and stops users faking demo or shared prices", async () => {
    await as(ALICE, async () => {
      expect(await rows("select * from public.ingredients")).toHaveLength(1);
      await expect(db.exec(`insert into public.ingredients (id, name, category, base_unit, diet_level, shelf_life_days) values ('x', 'x', 'Other', 'g', 'vegan', 1)`)).rejects.toThrow();
      await expect(
        db.exec(`insert into public.price_observations (product_id, owner_id, price_pence, source, confidence) values ('demo-onion', null, 1, 'manual', 'high')`),
      ).rejects.toThrow(/row-level security/);
      await db.exec(`insert into public.price_observations (product_id, owner_id, price_pence, observed_on, source, confidence) values ('demo-onion', '${ALICE}', 20, '2026-10-10', 'manual', 'high')`);
    });
    await as(BOB, async () => {
      // Bob sees the shared demo price but not Alice's manual one.
      expect((await rows("select price_pence from public.price_observations")).map((r) => r.price_pence)).toEqual([18]);
    });
  });

  it("refuses anonymous access to household data", async () => {
    await as(null, async () => {
      expect(await rows("select * from public.households")).toHaveLength(0);
      expect(await rows("select id from public.recipes")).toHaveLength(1);
    });
  });
});

describe("seed data", () => {
  it("applies cleanly on top of the migration and is idempotent", async () => {
    const { buildSeedSql } = await import("../../scripts/generate-seed-sql");
    const { SEED_RECIPES } = await import("@/lib/data/recipes");
    const fresh = new PGlite();
    await fresh.exec(AUTH_STUB);
    const dir = join(process.cwd(), "supabase", "migrations");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await fresh.exec(readFileSync(join(dir, f), "utf8"));
    const sql = buildSeedSql();
    await fresh.exec(sql);
    await fresh.exec(sql); // re-running must not fail
    const count = (await fresh.query<{ n: number }>("select count(*)::int as n from public.recipes")).rows[0].n;
    expect(count).toBe(SEED_RECIPES.length);
    const demo = (await fresh.query<{ n: number }>("select count(*)::int as n from public.price_observations where source = 'demo' and observed_on is not null")).rows[0].n;
    expect(demo).toBe(0);
  }, 60_000);
});
