-- Handbook sign-off rounds: every listed person reads the whole handbook,
-- confirms "I have read it", then signs and dates. A daily reminder email
-- goes to anyone not yet signed (edge function handbook-reminders, 9am).
-- Service role only (the app uses the admin client after checking the session).

create table if not exists public.handbook_signoff_rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  started_on date not null,
  due_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.handbook_signoffs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.handbook_signoff_rounds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_confirmed_at timestamptz,
  signed_name text,
  signature_data text,
  signed_on date,
  signed_at timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (round_id, profile_id),
  constraint signed_needs_everything check (
    signed_at is null or (read_confirmed_at is not null and signed_name is not null
      and signature_data is not null and signed_on is not null)
  )
);

create table if not exists public.handbook_reads (
  round_id uuid not null references public.handbook_signoff_rounds(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  article_id uuid not null references public.handbook_articles(id) on delete cascade,
  first_opened_at timestamptz not null default now(),
  primary key (round_id, profile_id, article_id)
);

create table if not exists public.handbook_reminder_log (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.handbook_signoff_rounds(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  sent_on date not null,
  recipient text not null,
  kind text not null default 'staff',
  ok boolean not null,
  detail text,
  created_at timestamptz not null default now()
);
create unique index if not exists handbook_reminder_once_a_day
  on public.handbook_reminder_log (round_id, recipient, sent_on, kind) where ok;

alter table public.handbook_signoff_rounds enable row level security;
alter table public.handbook_signoffs enable row level security;
alter table public.handbook_reads enable row level security;
alter table public.handbook_reminder_log enable row level security;

-- First round: whole handbook, two weeks from Tue 22 Sep 2026.
-- Everyone active on staff/manager except Ben (co-owner).
with r as (
  insert into public.handbook_signoff_rounds (title, started_on, due_on)
  values ('Staff handbook: read and sign', date '2026-09-22', date '2026-10-06')
  returning id
)
insert into public.handbook_signoffs (round_id, profile_id)
select r.id, p.id from r, public.profiles p
where p.active and p.role in ('staff','manager') and p.name <> 'Ben Rudland';
