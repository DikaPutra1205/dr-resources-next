-- ============================================================
-- DR Resources - Supabase Schema
-- Jalankan ini di Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null default 'user' check (role in ('admin', 'user')),
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles: users can read all" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles: admin can insert" on public.profiles for insert with check (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
create policy "profiles: admin can update" on public.profiles for update using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
create policy "profiles: admin can delete" on public.profiles for delete using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'), new.email, coalesce(new.raw_user_meta_data->>'role', 'user'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- 2. Kingdoms
create table public.kingdoms (
  id         serial primary key,
  name       text not null,
  color_hex  text not null default '#2BB673',
  created_at timestamptz default now()
);
alter table public.kingdoms enable row level security;
create policy "kingdoms: authenticated can read" on public.kingdoms for select using (auth.role() = 'authenticated');
create policy "kingdoms: admin can write" on public.kingdoms for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- 3. Game Accounts
create table public.game_accounts (
  id                  serial primary key,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  kingdom_id          integer references public.kingdoms(id) on delete set null,
  kingdom             text,
  name                text not null,
  type                text not null default 'main' check (type in ('main', 'farm')),
  trading_post_level  integer not null default 1,
  storehouse_level    integer not null default 1,
  notes               text,
  created_at          timestamptz default now()
);
alter table public.game_accounts enable row level security;
create policy "game_accounts: authenticated can read" on public.game_accounts for select using (auth.role() = 'authenticated');
create policy "game_accounts: owner can write" on public.game_accounts for all using (auth.uid() = user_id);
create policy "game_accounts: admin can write all" on public.game_accounts for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- 4. Resource Stocks
create table public.resource_stocks (
  id              serial primary key,
  game_account_id integer not null unique references public.game_accounts(id) on delete cascade,
  food            bigint not null default 0,
  wood            bigint not null default 0,
  stone           bigint not null default 0,
  gold            bigint not null default 0,
  updated_at      timestamptz default now()
);
alter table public.resource_stocks enable row level security;
create policy "resource_stocks: authenticated can read" on public.resource_stocks for select using (auth.role() = 'authenticated');
create policy "resource_stocks: owner can write" on public.resource_stocks for all using (
  exists (select 1 from public.game_accounts where id = game_account_id and user_id = auth.uid())
);
create policy "resource_stocks: admin can write all" on public.resource_stocks for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- 5. Trading Post Configs (static data, no RLS needed)
create table public.trading_post_configs (
  level             integer primary key,
  tax_rate          numeric(5,4) not null,
  capacity_per_trip integer not null
);
alter table public.trading_post_configs enable row level security;
create policy "tp_configs: public read" on public.trading_post_configs for select using (true);

-- 6. Storehouse Configs (static data)
create table public.storehouse_configs (
  level            integer primary key,
  food_protection  bigint not null default 0,
  wood_protection  bigint not null default 0,
  stone_protection bigint not null default 0,
  gold_protection  bigint not null default 0
);
alter table public.storehouse_configs enable row level security;
create policy "sh_configs: public read" on public.storehouse_configs for select using (true);

-- 7. Resource Prices
create table public.resource_prices (
  id                serial primary key,
  kingdom_id        integer references public.kingdoms(id) on delete cascade,
  resource          text not null check (resource in ('food', 'wood', 'stone', 'gold')),
  price_per_million numeric(10,2) not null default 0,
  unique (kingdom_id, resource)
);
alter table public.resource_prices enable row level security;
create policy "resource_prices: authenticated can read" on public.resource_prices for select using (auth.role() = 'authenticated');
create policy "resource_prices: admin can write" on public.resource_prices for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- 8. Transactions
create table public.transactions (
  id                     serial primary key,
  created_by             uuid not null references public.profiles(id),
  to_name                text not null,
  notes                  text,
  sent_at                timestamptz not null default now(),
  kingdom                text,
  total_food_sent        bigint not null default 0,
  total_wood_sent        bigint not null default 0,
  total_stone_sent       bigint not null default 0,
  total_gold_sent        bigint not null default 0,
  total_food_received    bigint not null default 0,
  total_wood_received    bigint not null default 0,
  total_stone_received   bigint not null default 0,
  total_gold_received    bigint not null default 0,
  total_estimated_value  numeric(12,4) not null default 0,
  created_at             timestamptz default now()
);
alter table public.transactions enable row level security;
create policy "transactions: authenticated can read" on public.transactions for select using (auth.role() = 'authenticated');
create policy "transactions: admin can write" on public.transactions for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- 9. Transaction Contributions
create table public.transaction_contributions (
  id               serial primary key,
  transaction_id   integer not null references public.transactions(id) on delete cascade,
  game_account_id  integer not null references public.game_accounts(id),
  food_sent        bigint not null default 0,
  wood_sent        bigint not null default 0,
  stone_sent       bigint not null default 0,
  gold_sent        bigint not null default 0,
  food_received    bigint not null default 0,
  wood_received    bigint not null default 0,
  stone_received   bigint not null default 0,
  gold_received    bigint not null default 0,
  tax_rate         numeric(5,4) not null default 0,
  total_trips      integer not null default 0,
  trip_details     jsonb
);
alter table public.transaction_contributions enable row level security;
create policy "tx_contributions: authenticated can read" on public.transaction_contributions for select using (auth.role() = 'authenticated');
create policy "tx_contributions: admin can write" on public.transaction_contributions for all using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- ============================================================
-- SEED: Trading Post & Storehouse static data
-- ============================================================
insert into public.trading_post_configs (level, tax_rate, capacity_per_trip) values
(1,0.35,10000),(2,0.34,30000),(3,0.33,60000),(4,0.32,100000),(5,0.31,160000),
(6,0.30,240000),(7,0.29,320000),(8,0.28,400000),(9,0.27,500000),(10,0.26,600000),
(11,0.25,800000),(12,0.24,1000000),(13,0.23,1200000),(14,0.22,1400000),(15,0.21,1600000),
(16,0.20,1800000),(17,0.19,2000000),(18,0.18,2200000),(19,0.17,2400000),(20,0.16,2600000),
(21,0.15,2800000),(22,0.14,3000000),(23,0.12,3500000),(24,0.10,4000000),(25,0.08,10000000);

insert into public.storehouse_configs (level,food_protection,wood_protection,stone_protection,gold_protection) values
(1,300000,300000,225000,150000),(2,320000,320000,225000,160000),(3,350000,350000,262500,175000),
(4,380000,380000,285000,190000),(5,410000,410000,307500,205000),(6,450000,450000,337500,225000),
(7,500000,500000,375000,250000),(8,550000,550000,412500,275000),(9,600000,600000,450000,300000),
(10,650000,650000,487500,325000),(11,700000,700000,525000,350000),(12,750000,750000,562500,375000),
(13,800000,800000,600000,400000),(14,850000,850000,637500,425000),(15,900000,900000,675000,450000),
(16,1000000,1000000,750000,500000),(17,1100000,1100000,825000,550000),(18,1200000,1200000,900000,600000),
(19,1300000,1300000,975000,650000),(20,1400000,1400000,1050000,700000),(21,1500000,1500000,1125000,750000),
(22,1600000,1600000,1200000,800000),(23,1800000,1800000,1350000,900000),(24,2000000,2000000,1500000,1000000),
(25,2500000,2500000,2500000,2500000);

-- ============================================================
-- 10. Activity Logs
-- ============================================================
create table public.activity_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  action     text not null,
  details    jsonb,
  created_at timestamptz default now()
);
alter table public.activity_logs enable row level security;
create policy "activity_logs: admin can read" on public.activity_logs for select using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);
create policy "activity_logs: authenticated can insert" on public.activity_logs for insert with check (auth.role() = 'authenticated');

-- Auto-cleanup: keep max 1000 log entries
create or replace function public.cleanup_activity_logs()
returns trigger as $$
declare
  max_keep constant int := 1000;
  cutoff_id bigint;
begin
  select id into cutoff_id from public.activity_logs order by id desc limit 1 offset max_keep - 1;
  if cutoff_id is not null then
    delete from public.activity_logs where id <= cutoff_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;
create trigger cleanup_activity_logs_trigger
after insert on public.activity_logs
for each statement execute function public.cleanup_activity_logs();

-- Auto-cleanup transactions: keep max 500 entries
create or replace function public.cleanup_transactions()
returns trigger as $$
declare
  max_keep constant int := 500;
  cutoff_id bigint;
begin
  select id into cutoff_id from public.transactions order by id desc limit 1 offset max_keep - 1;
  if cutoff_id is not null then
    delete from public.transactions where id <= cutoff_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;
create trigger cleanup_transactions_trigger
after insert on public.transactions
for each statement execute function public.cleanup_transactions();

-- ============================================================
-- SEED: Admin user Dika
-- Jalankan setelah schema selesai, lalu buat user via Supabase Auth
-- kemudian update role-nya:
-- update public.profiles set role = 'admin' where email = 'dika@dr-resources.com';
-- ============================================================
