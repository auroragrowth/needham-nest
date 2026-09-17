-- Applied 17 Sep 2026 (migrations wastage_wasted_at, waste_checks).

-- When the stock was actually wasted (UK time chosen by the person logging it),
-- separate from created_at, which is when it was logged.
alter table public.stock_movements add column if not exists wasted_at timestamptz;
update public.stock_movements set wasted_at = created_at where wastage_reason is not null and wasted_at is null;
alter table public.stock_movements drop constraint if exists stock_movements_wastage_needs_time;
alter table public.stock_movements add constraint stock_movements_wastage_needs_time
  check (wastage_reason is null or wasted_at is not null);

-- The closer's daily confirmation that all of today's waste is logged (or that
-- nothing was wasted). Clock-out for whoever closes up is blocked without it.
create table if not exists public.waste_checks (
  day date primary key,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  entries integer not null check (entries >= 0),
  nothing_wasted boolean not null
);
alter table public.waste_checks enable row level security;
revoke all on public.waste_checks from anon, authenticated;
