-- Schéma distant (sauvegarde synchronisée), miroir des tables synchronisées du schéma Drizzle local
-- (src/db/schema.ts, SYNCED_TABLES). sync_queue et settings restent locales.
-- Conventions : id UUID généré sur le client, updated_at géré par le client, suppression logique
-- via deleted_at. Pas de clés étrangères entre tables : le push peut arriver dans n'importe quel ordre.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  position integer not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint categories_position_range check (position between 1 and 9),
  constraint categories_name_not_empty check (length(trim(name)) > 0)
);

create unique index categories_user_position_unique on public.categories (user_id, position);
create index categories_user_updated_idx on public.categories (user_id, updated_at);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount_da integer not null,
  currency text not null check (currency in ('DZD', 'EUR')),
  original_amount_cents integer,
  eur_rate double precision,
  -- Requis si expense, null si income.
  category_id uuid,
  note text,
  date date not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint transactions_amount_positive check (amount_da > 0),
  constraint transactions_eur_fields check (
    (currency = 'DZD' and original_amount_cents is null and eur_rate is null)
    or (currency = 'EUR' and original_amount_cents is not null and original_amount_cents > 0
      and eur_rate is not null and eur_rate > 0)
  ),
  constraint transactions_category_by_type check (
    (type = 'expense' and category_id is not null)
    or (type = 'income' and category_id is null)
  )
);

create index transactions_user_date_idx on public.transactions (user_id, date);
create index transactions_user_updated_idx on public.transactions (user_id, updated_at);
create index transactions_category_idx on public.transactions (category_id);

create table public.recurring_payments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount_da integer not null,
  category_id uuid not null,
  frequency text not null check (frequency in ('monthly', 'yearly')),
  day_of_month integer not null,
  -- 1–12 si yearly, null si monthly.
  month integer,
  start_date date not null,
  active boolean not null,
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint recurring_payments_amount_positive check (amount_da > 0),
  constraint recurring_payments_day_range check (day_of_month between 1 and 31),
  constraint recurring_payments_month_by_frequency check (
    (frequency = 'monthly' and month is null)
    or (frequency = 'yearly' and month is not null and month between 1 and 12)
  ),
  constraint recurring_payments_name_not_empty check (length(trim(name)) > 0)
);

create index recurring_payments_user_updated_idx on public.recurring_payments (user_id, updated_at);
create index recurring_payments_category_idx on public.recurring_payments (category_id);

-- Une ligne par échéance payée (les échéances dues sont calculées côté client).
create table public.recurring_occurrences (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recurring_payment_id uuid not null,
  due_date date not null,
  paid_at date not null,
  transaction_id uuid not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index recurring_occurrences_payment_due_unique
  on public.recurring_occurrences (recurring_payment_id, due_date);
create index recurring_occurrences_user_updated_idx
  on public.recurring_occurrences (user_id, updated_at);

create table public.debt_people (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint debt_people_name_not_empty check (length(trim(name)) > 0)
);

-- Unique par utilisateur, insensible à la casse (les accents sont comparés côté app).
create unique index debt_people_user_name_unique on public.debt_people (user_id, lower(name));
create index debt_people_user_updated_idx on public.debt_people (user_id, updated_at);

create table public.debts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction text not null check (direction in ('i_owe', 'owed_to_me')),
  person_id uuid not null,
  amount_da integer not null,
  currency text not null check (currency in ('DZD', 'EUR')),
  original_amount_cents integer,
  eur_rate double precision,
  date date not null,
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint debts_amount_positive check (amount_da > 0),
  constraint debts_eur_fields check (
    (currency = 'DZD' and original_amount_cents is null and eur_rate is null)
    or (currency = 'EUR' and original_amount_cents is not null and original_amount_cents > 0
      and eur_rate is not null and eur_rate > 0)
  )
);

create index debts_user_direction_idx on public.debts (user_id, direction);
create index debts_user_updated_idx on public.debts (user_id, updated_at);
create index debts_person_idx on public.debts (person_id);

create table public.debt_repayments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id uuid not null,
  amount_da integer not null,
  currency text not null check (currency in ('DZD', 'EUR')),
  original_amount_cents integer,
  eur_rate double precision,
  date date not null,
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  constraint debt_repayments_amount_positive check (amount_da > 0),
  constraint debt_repayments_eur_fields check (
    (currency = 'DZD' and original_amount_cents is null and eur_rate is null)
    or (currency = 'EUR' and original_amount_cents is not null and original_amount_cents > 0
      and eur_rate is not null and eur_rate > 0)
  )
);

create index debt_repayments_debt_idx on public.debt_repayments (debt_id);
create index debt_repayments_user_updated_idx on public.debt_repayments (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- RLS : chaque utilisateur ne lit et n'écrit que ses lignes (user_id = auth.uid()).
-- Pas de DELETE : suppressions logiques uniquement (deleted_at), via upsert.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'transactions', 'recurring_payments', 'recurring_occurrences',
    'debt_people', 'debts', 'debt_repayments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t
    );
  end loop;
end
$$;
