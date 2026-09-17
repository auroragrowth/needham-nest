-- Applied 17 Sep 2026 (migration waste_confirmations_per_shift).
-- Every member of staff confirms their own waste before clocking out: one row
-- per shift. Replaces waste_checks (one row per day, closer only), which was
-- created earlier the same day and never used.
create table if not exists public.waste_confirmations (
  time_log_id uuid primary key references public.time_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  entries integer not null check (entries >= 0),
  nothing_wasted boolean not null
);
alter table public.waste_confirmations enable row level security;
revoke all on public.waste_confirmations from anon, authenticated;
drop table if exists public.waste_checks;
