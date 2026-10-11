-- Plate Planner – initial relational schema for optional Supabase cloud sync.
--
-- The app works fully offline with browser storage. This schema is the cloud
-- model: user-owned rows are protected by row-level security (RLS) so a user can
-- only ever see or change their own household's data. Reference data (ingredient
-- catalogue, built-in recipes, supermarkets, demo prices) is readable by everyone
-- and writable only by the service role (migrations / seed).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.base_unit as enum ('g', 'ml', 'item');
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner');
create type public.meal_kind as enum ('cook', 'leftover');
create type public.storage_location as enum ('cupboard', 'fridge', 'freezer');
create type public.date_kind as enum ('use-by', 'best-before');
create type public.price_source as enum ('demo', 'manual', 'provider');
create type public.price_confidence as enum ('low', 'medium', 'high');
create type public.restriction_kind as enum ('diet', 'allergen', 'allergy_term', 'dislike');
create type public.recipe_source as enum ('original', 'user', 'imported');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.supermarkets (
  id text primary key,
  name text not null
);

create table public.ingredients (
  id text primary key,                          -- stable id, e.g. 'onion'
  name text not null,
  plural text,
  category text not null,
  base_unit public.base_unit not null,          -- canonical unit for all quantities
  item_label text,
  grams_per_item numeric check (grams_per_item > 0),
  density_g_per_ml numeric check (density_g_per_ml > 0),
  diet_level text not null check (diet_level in ('vegan', 'vegetarian', 'pescatarian', 'meat')),
  shelf_life_days integer not null check (shelf_life_days > 0),
  is_staple boolean not null default false,
  protein text,
  note text
);

create table public.ingredient_aliases (
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  alias text not null,
  primary key (ingredient_id, alias)
);

-- Ingredient-specific units, e.g. ('chopped-tomatoes', 'tin', 400)
create table public.ingredient_units (
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  unit text not null,
  base_quantity numeric not null check (base_quantity > 0),
  primary key (ingredient_id, unit)
);

create table public.ingredient_allergens (
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  allergen text not null,
  may_contain boolean not null default false,
  primary key (ingredient_id, allergen)
);

-- ---------------------------------------------------------------------------
-- Households (one owner per household)
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'My household',
  adults integer not null default 2 check (adults between 1 and 12),
  children integer not null default 0 check (children between 0 and 12),
  portions_per_meal numeric not null default 2 check (portions_per_meal between 1 and 24),
  supermarket_id text not null default 'tesco' references public.supermarkets(id),
  weekly_budget_pence integer not null default 6000 check (weekly_budget_pence >= 0),
  budget_scope text not null default 'planned-meals' check (budget_scope in ('planned-meals', 'all-groceries')),
  -- Remaining preferences (slots, days, times, equipment, cuisines, priorities, weights…)
  -- are validated by the app's Zod schema before being written.
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index households_owner_idx on public.households(owner_id);

create table public.household_restrictions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind public.restriction_kind not null,
  value text not null,
  unique (household_id, kind, value)
);

-- ---------------------------------------------------------------------------
-- Recipes (owner_id null = built-in, readable by all)
-- ---------------------------------------------------------------------------
create table public.recipes (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (length(name) >= 2),
  description text not null default '',
  cuisine text not null default 'other',
  meal_types public.meal_slot[] not null,
  servings integer not null check (servings between 1 and 24),
  prep_mins integer not null check (prep_mins >= 0),
  cook_mins integer not null check (cook_mins >= 0),
  storage text,
  keeps_days integer not null default 0 check (keeps_days between 0 and 7),
  freezable boolean not null default false,
  tags text[] not null default '{}',
  equipment text[] not null default '{}',
  difficulty text not null default 'easy',
  emoji text not null default '🍽️',
  hue integer not null default 30,
  image_url text,
  source public.recipe_source not null default 'user',
  -- Nutrition only where reliable data exists; source is mandatory if present.
  nutrition_kcal numeric,
  nutrition_source text,
  check ((nutrition_kcal is null) = (nutrition_source is null)),
  created_at timestamptz not null default now()
);
create index recipes_owner_idx on public.recipes(owner_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null references public.recipes(id) on delete cascade,
  position integer not null,
  ingredient_id text references public.ingredients(id),
  name text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  note text,
  optional boolean not null default false,
  unique (recipe_id, position)
);

create table public.recipe_steps (
  recipe_id text not null references public.recipes(id) on delete cascade,
  position integer not null,
  body text not null,
  primary key (recipe_id, position)
);

create table public.recipe_substitutions (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null references public.recipes(id) on delete cascade,
  ingredient_id text not null references public.ingredients(id),
  position integer not null,
  alt_ingredient_id text references public.ingredients(id),
  alt_name text not null,
  ratio numeric not null default 1 check (ratio > 0),
  note text
);

-- ---------------------------------------------------------------------------
-- Meal plans
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start)
);

create table public.planned_meals (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  meal_date date not null,
  slot public.meal_slot not null,
  recipe_id text not null references public.recipes(id),
  servings numeric not null check (servings > 0),
  locked boolean not null default false,
  cooked boolean not null default false,
  kind public.meal_kind not null default 'cook',
  leftover_of uuid references public.planned_meals(id) on delete cascade,
  substitutions jsonb not null default '{}'::jsonb,
  reasons text[] not null default '{}',
  score integer,
  unique (meal_plan_id, meal_date, slot),
  check ((kind = 'leftover') = (leftover_of is not null))
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  ingredient_id text references public.ingredients(id),
  name text not null,
  quantity numeric check (quantity >= 0),          -- null = "have some"
  unit text not null default '',
  location public.storage_location not null,
  purchased_on date,
  date_kind public.date_kind,
  date date,
  remaining numeric check (remaining between 0 and 1),
  added_at timestamptz not null default now()
);
create index inventory_household_idx on public.inventory_items(household_id);

-- ---------------------------------------------------------------------------
-- Shopping lists. Calculated lines are derived from the plan; only the user's
-- state (ticks, "already have", quantity edits) and ad hoc items are stored.
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null,
  unique (household_id, week_start)
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  line_key text,                                 -- calculated line key (ingredient id) or null for ad hoc
  name text,                                     -- ad hoc items only
  quantity_text text,
  category text,
  price_pence integer check (price_pence >= 0),
  checked boolean not null default false,
  owned boolean not null default false,
  override_quantity numeric check (override_quantity >= 0),
  check (line_key is not null or name is not null)
);

-- ---------------------------------------------------------------------------
-- Products & prices (owner_id null = shared reference/demo data)
-- ---------------------------------------------------------------------------
create table public.products (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  supermarket_id text not null references public.supermarkets(id),
  ingredient_id text not null references public.ingredients(id),
  name text not null,
  brand text,
  own_brand boolean not null default false,
  pack_size numeric not null check (pack_size > 0),   -- in the ingredient's base unit
  pack_label text not null,
  url text
);
create index products_lookup_idx on public.products(supermarket_id, ingredient_id);

create table public.price_observations (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  price_pence integer not null check (price_pence >= 0),
  observed_on date,                                    -- null for undated demo data
  source public.price_source not null,
  confidence public.price_confidence not null,
  -- Demo data must never masquerade as a checked price.
  check (source <> 'demo' or observed_on is null)
);
create index price_obs_product_idx on public.price_observations(product_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
create or replace function public.owns_household(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.households h where h.id = hid and h.owner_id = auth.uid());
$$;

create or replace function public.owns_meal_plan(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meal_plans p join public.households h on h.id = p.household_id
    where p.id = pid and h.owner_id = auth.uid()
  );
$$;

create or replace function public.owns_shopping_list(lid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shopping_lists l join public.households h on h.id = l.household_id
    where l.id = lid and h.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_recipe(rid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.recipes r where r.id = rid and (r.owner_id is null or r.owner_id = auth.uid()));
$$;

create or replace function public.owns_recipe(rid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.recipes r where r.id = rid and r.owner_id = auth.uid());
$$;

alter table public.supermarkets enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.ingredient_units enable row level security;
alter table public.ingredient_allergens enable row level security;
alter table public.households enable row level security;
alter table public.household_restrictions enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_substitutions enable row level security;
alter table public.meal_plans enable row level security;
alter table public.planned_meals enable row level security;
alter table public.inventory_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.products enable row level security;
alter table public.price_observations enable row level security;

-- Reference data: read-only for everyone (writes only via service role, which bypasses RLS).
create policy "reference read" on public.supermarkets for select using (true);
create policy "reference read" on public.ingredients for select using (true);
create policy "reference read" on public.ingredient_aliases for select using (true);
create policy "reference read" on public.ingredient_units for select using (true);
create policy "reference read" on public.ingredient_allergens for select using (true);

-- Households: owner only.
create policy "own households" on public.households
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "own restrictions" on public.household_restrictions
  for all to authenticated
  using (public.owns_household(household_id))
  with check (public.owns_household(household_id));

-- Recipes: built-ins readable by all; user recipes by their owner only.
create policy "read recipes" on public.recipes for select using (owner_id is null or owner_id = auth.uid());
create policy "insert own recipes" on public.recipes for insert to authenticated with check (owner_id = auth.uid());
create policy "update own recipes" on public.recipes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own recipes" on public.recipes for delete to authenticated using (owner_id = auth.uid());

create policy "read recipe parts" on public.recipe_ingredients for select using (public.can_read_recipe(recipe_id));
create policy "write own recipe parts" on public.recipe_ingredients for all to authenticated using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));
create policy "read recipe steps" on public.recipe_steps for select using (public.can_read_recipe(recipe_id));
create policy "write own recipe steps" on public.recipe_steps for all to authenticated using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));
create policy "read recipe subs" on public.recipe_substitutions for select using (public.can_read_recipe(recipe_id));
create policy "write own recipe subs" on public.recipe_substitutions for all to authenticated using (public.owns_recipe(recipe_id)) with check (public.owns_recipe(recipe_id));

-- Plans, inventory, shopping: via household ownership.
create policy "own plans" on public.meal_plans for all to authenticated
  using (public.owns_household(household_id)) with check (public.owns_household(household_id));
create policy "own planned meals" on public.planned_meals for all to authenticated
  using (public.owns_meal_plan(meal_plan_id))
  with check (public.owns_meal_plan(meal_plan_id) and public.can_read_recipe(recipe_id));
create policy "own inventory" on public.inventory_items for all to authenticated
  using (public.owns_household(household_id)) with check (public.owns_household(household_id));
create policy "own shopping lists" on public.shopping_lists for all to authenticated
  using (public.owns_household(household_id)) with check (public.owns_household(household_id));
create policy "own shopping items" on public.shopping_list_items for all to authenticated
  using (public.owns_shopping_list(shopping_list_id)) with check (public.owns_shopping_list(shopping_list_id));

-- Products & prices: shared rows readable by all; personal (manual) rows owner only.
create policy "read products" on public.products for select using (owner_id is null or owner_id = auth.uid());
create policy "write own products" on public.products for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "read prices" on public.price_observations for select using (owner_id is null or owner_id = auth.uid());
create policy "write own prices" on public.price_observations for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and source = 'manual');

-- Keep updated_at fresh.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger households_touch before update on public.households for each row execute function public.touch_updated_at();
create trigger meal_plans_touch before update on public.meal_plans for each row execute function public.touch_updated_at();

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
