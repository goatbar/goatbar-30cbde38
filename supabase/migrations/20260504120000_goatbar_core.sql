create extension if not exists "pgcrypto";

create table if not exists public.drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cost numeric not null default 0,
  price numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  location text not null check (location in ('7steakhouse','goatbotequim')),
  total_revenue numeric not null default 0,
  total_cost numeric not null default 0,
  total_profit numeric not null default 0
);

create table if not exists public.sales_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  drink_id uuid not null references public.drinks(id),
  quantity numeric not null,
  price numeric not null,
  cost numeric not null
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  event_type text not null,
  date date not null,
  guests integer not null,
  duration numeric not null,
  total_cost numeric not null,
  total_price numeric not null,
  total_profit numeric not null
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  quantity numeric not null default 0,
  unit text not null,
  cost_per_unit numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  type text not null check (type in ('in','out','loss')),
  quantity numeric not null,
  source text not null check (source in ('event','sale','manual')),
  created_at timestamptz not null default now()
);

alter table public.drinks enable row level security;
alter table public.sales enable row level security;
alter table public.sales_items enable row level security;
alter table public.events enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;

create policy if not exists "authenticated full access drinks" on public.drinks for all to authenticated using (true) with check (true);
create policy if not exists "authenticated full access sales" on public.sales for all to authenticated using (true) with check (true);
create policy if not exists "authenticated full access sales_items" on public.sales_items for all to authenticated using (true) with check (true);
create policy if not exists "authenticated full access events" on public.events for all to authenticated using (true) with check (true);
create policy if not exists "authenticated full access inventory" on public.inventory for all to authenticated using (true) with check (true);
create policy if not exists "authenticated full access inventory_movements" on public.inventory_movements for all to authenticated using (true) with check (true);
