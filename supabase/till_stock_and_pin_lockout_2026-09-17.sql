-- Applied 17 Sep 2026 as migration till_stock_link_and_pin_lockout. Recorded
-- here so the repo matches the database.

-- ---------------------------------------------------------------- till stock
-- The till is the source of truth for the items it sells. Each has a stock_item
-- linked by till_item_id (src/lib/till/stock.ts keeps name and category in step),
-- and till_count_sent_at is the stock take count last sent to the till.
alter table public.stock_items add column if not exists till_item_id text;
alter table public.stock_items add column if not exists till_count_sent_at timestamptz;
create unique index if not exists stock_items_till_item_id_key on public.stock_items (till_item_id) where till_item_id is not null;

-- Applied later the same day as migration stock_items_till_servings_per_unit:
-- a till item counted in bigger units than the till sells (a 7L bag-in-box of
-- post-mix sold as 16oz servings) is sent to the till as servings. Null means 1.
alter table public.stock_items add column if not exists till_servings_per_unit numeric;
alter table public.stock_items drop constraint if exists stock_items_till_servings_per_unit_positive;
alter table public.stock_items add constraint stock_items_till_servings_per_unit_positive
  check (till_servings_per_unit is null or till_servings_per_unit > 0);

-- The two stock items that were already the till's Cookies and Choc Vegan Loaf.
update public.stock_items set till_item_id = 'cookies' where id = '0b7032ed-e490-473a-8abc-2283d8b52c97' and till_item_id is null;
update public.stock_items set till_item_id = 'vegan-loaf' where id = '3bcebd2e-ba1d-4c13-b1d4-496808546192' and till_item_id is null;

-- ------------------------------------------------------------- PIN lockout
-- Three wrong PINs from one device locks it for a minute. The device key is a
-- hash of the address the request came from (src/lib/auth/actions.ts).
create table if not exists public.pin_login_guard (
  device_key     text primary key,
  failures       int not null default 0,
  last_failed_at timestamptz,
  locked_until   timestamptz
);
alter table public.pin_login_guard enable row level security;
revoke all on public.pin_login_guard from anon, authenticated;

create or replace function public.pin_sign_in(p_pin text, p_device_key text)
returns table (outcome text, wait_seconds int, profile_id uuid, name text, role public.user_role, auth_user_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  g public.pin_login_guard%rowtype;
  m record;
begin
  if p_device_key is null or length(p_device_key) = 0 then
    raise exception 'device key required';
  end if;
  perform pg_advisory_xact_lock(hashtext('pin:' || p_device_key));

  -- Forget devices nobody has tried from for a day.
  delete from public.pin_login_guard
   where coalesce(locked_until, last_failed_at) < now() - interval '1 day';

  select * into g from public.pin_login_guard where device_key = p_device_key;
  if found and g.locked_until > now() then
    return query select 'locked'::text, ceil(extract(epoch from g.locked_until - now()))::int,
      null::uuid, null::text, null::public.user_role, null::uuid;
    return;
  end if;

  select v.profile_id, v.name, v.role, v.auth_user_id into m from public.verify_pin(p_pin) v;
  if m.profile_id is not null then
    delete from public.pin_login_guard where device_key = p_device_key;
    return query select 'ok'::text, 0, m.profile_id, m.name, m.role, m.auth_user_id;
    return;
  end if;

  insert into public.pin_login_guard as pg (device_key, failures, last_failed_at, locked_until)
  values (p_device_key, 1, now(), null)
  on conflict (device_key) do update set
    -- A wrong PIN a quarter of an hour after the last one starts the count again.
    failures = case when pg.last_failed_at < now() - interval '15 minutes' or pg.locked_until is not null
                    then 1 else pg.failures + 1 end,
    last_failed_at = now(),
    locked_until = null
  returning * into g;

  if g.failures >= 3 then
    update public.pin_login_guard set locked_until = now() + interval '1 minute', failures = 0
     where device_key = p_device_key;
    return query select 'locked'::text, 60, null::uuid, null::text, null::public.user_role, null::uuid;
    return;
  end if;
  return query select 'wrong'::text, 0, null::uuid, null::text, null::public.user_role, null::uuid;
end $$;
revoke all on function public.pin_sign_in(text, text) from public, anon, authenticated;
grant execute on function public.pin_sign_in(text, text) to service_role;

-- ------------------------------------------------------ event booking form
-- Applied the same day as migration close_public_event_booking_form. Paul
-- retired the website's event booking form, so nobody outside the app can add a
-- booking any more (this closes the one anon insert kept in
-- security_fixes_2026-09-16.sql). The 15 bookings already made are kept.
drop policy if exists event_bookings_public_insert on public.event_bookings;
revoke insert on public.event_bookings from anon;
