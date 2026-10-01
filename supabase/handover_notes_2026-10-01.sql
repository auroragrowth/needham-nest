-- Handover notes: what the next shift needs to know ("milk delivery short,
-- coffee machine leaking, table 4 booked for 11"). Written and read on the
-- tablet, newest first. Service role only (the app uses the admin client after
-- checking the session).

create table if not exists public.handover_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (length(btrim(body)) between 1 and 2000),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists handover_notes_created_at_idx
  on public.handover_notes (created_at desc);

alter table public.handover_notes enable row level security;
