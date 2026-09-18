-- Applied 18 Sep 2026 as migration till_usage_storage_and_run_outs.
--
-- 1. Sales come off the café zone first, then the kitchen, then — as a last
--    resort — storage. Never below zero.
-- 2. When selling takes an item to nothing, or sells more than the iPad says
--    there is, a run-out is opened: the owner gets a push (src/lib/alerts/
--    stock.ts, from the till-stock cron) and Nesty can list them
--    (nesty_run_outs). One open run-out per item, so a thing that keeps selling
--    at zero doesn't push every 15 minutes; it closes itself once the item has
--    stock again (a count or a delivery).
-- 3. The shortfalls from the runs before storage counted are taken out of
--    storage now, as they would have been.

create table if not exists public.stock_run_outs (
  id            uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  -- 'out': the till sold the last of it. 'short': the till sold more than the
  -- iPad said there was — below zero, if it were allowed to go there.
  kind          text not null check (kind in ('out', 'short')),
  short_by      numeric not null default 0,
  opened_at     timestamptz not null default now(),
  pushed_at     timestamptz,
  resolved_at   timestamptz
);
create unique index if not exists stock_run_outs_one_open on public.stock_run_outs (stock_item_id) where resolved_at is null;
alter table public.stock_run_outs enable row level security;
revoke all on public.stock_run_outs from anon, authenticated;

-- Takes a sold quantity off the shelves: café, then kitchen, then storage.
-- Returns what couldn't be found.
create or replace function public.take_sold_stock(p_item uuid, p_qty numeric, p_note text default 'Sold on the till')
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_left  numeric := round(p_qty, 4);
  v_take  numeric;
  v_place record;
begin
  for v_place in
    select p.id, p.location_id, p.quantity
      from stock_placements p
      join stock_locations l on l.id = p.location_id
     where p.stock_item_id = p_item and l.active and p.quantity > 0
     order by case l.zone when 'cafe' then 0 when 'kitchen' then 1 else 2 end, l.sort_order, l.name
       for update of p
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_place.quantity);
    update stock_placements set quantity = round(v_place.quantity - v_take, 4), updated_at = now()
     where id = v_place.id;
    insert into stock_location_moves
      (stock_item_id, from_location_id, quantity, kind, previous_quantity, new_quantity, notes)
    values (p_item, v_place.location_id, v_take, 'sale', v_place.quantity, round(v_place.quantity - v_take, 4), p_note);
    v_left := v_left - v_take;
  end loop;
  return greatest(v_left, 0);
end $$;

-- After a sale: open a run-out if the item is now at nothing, or was short.
create or replace function public.note_stock_level(p_item uuid, p_short numeric)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(p.quantity), 0) into v_total
    from stock_placements p join stock_locations l on l.id = p.location_id and l.active
   where p.stock_item_id = p_item;

  if p_short > 0.0005 then
    insert into stock_run_outs (stock_item_id, kind, short_by) values (p_item, 'short', round(p_short, 4))
    on conflict (stock_item_id) where resolved_at is null
    do update set kind = 'short', short_by = stock_run_outs.short_by + excluded.short_by;
  elsif v_total <= 0.0005 then
    insert into stock_run_outs (stock_item_id, kind) values (p_item, 'out')
    on conflict (stock_item_id) where resolved_at is null do nothing;
  end if;
end $$;

create or replace function public.apply_till_usage(p_expected timestamptz, p_until timestamptz, p_items jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cursor  timestamptz;
  v_item    jsonb;
  v_qty     numeric;
  v_short   numeric;
  v_place   record;
  v_home    uuid;
  v_applied jsonb := '[]';
  v_shorts  jsonb := '[]';
  v_name    text;
begin
  if p_expected is null then
    insert into till_usage_cursor (id, until) values (1, p_until) on conflict (id) do nothing;
    if not found then
      return jsonb_build_object('skipped', true, 'cursor', (select until from till_usage_cursor where id = 1));
    end if;
  else
    select until into v_cursor from till_usage_cursor where id = 1 for update;
    if v_cursor is distinct from p_expected then
      return jsonb_build_object('skipped', true, 'cursor', v_cursor);
    end if;
  end if;

  -- A run-out is over once the item has stock again: counted, or delivered.
  update stock_run_outs r set resolved_at = now()
   where r.resolved_at is null
     and (select coalesce(sum(p.quantity), 0)
            from stock_placements p join stock_locations l on l.id = p.location_id and l.active
           where p.stock_item_id = r.stock_item_id) > 0.0005;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := round((v_item->>'quantity')::numeric, 4);
    continue when v_qty = 0;
    select name into v_name from stock_items where id = (v_item->>'stock_item_id')::uuid;

    if v_qty > 0 then
      v_short := take_sold_stock((v_item->>'stock_item_id')::uuid, v_qty);
      perform note_stock_level((v_item->>'stock_item_id')::uuid, v_short);
      v_applied := v_applied || jsonb_build_object('name', v_name, 'used', v_qty);
      if v_short > 0.0005 then
        v_shorts := v_shorts || jsonb_build_object('name', v_name, 'not_on_shelves', round(v_short, 4));
      end if;
    else
      -- A void goes back where the item lives: café, kitchen, then storage,
      -- else the first café location.
      select p.location_id into v_home
        from stock_placements p
        join stock_locations l on l.id = p.location_id
       where p.stock_item_id = (v_item->>'stock_item_id')::uuid and l.active
       order by case l.zone when 'cafe' then 0 when 'kitchen' then 1 else 2 end, l.sort_order, l.name
       limit 1;
      if v_home is null then
        select id into v_home from stock_locations where active and zone = 'cafe' order by sort_order, name limit 1;
      end if;
      if v_home is null then
        v_shorts := v_shorts || jsonb_build_object('name', v_name, 'nowhere_to_return', -v_qty);
        continue;
      end if;

      insert into stock_placements (stock_item_id, location_id, quantity)
      values ((v_item->>'stock_item_id')::uuid, v_home, 0)
      on conflict (stock_item_id, location_id) do nothing;
      select id, quantity into v_place from stock_placements
       where stock_item_id = (v_item->>'stock_item_id')::uuid and location_id = v_home
         for update;
      update stock_placements set quantity = round(v_place.quantity - v_qty, 4), updated_at = now()
       where id = v_place.id;
      insert into stock_location_moves
        (stock_item_id, to_location_id, quantity, kind, previous_quantity, new_quantity, notes)
      values
        ((v_item->>'stock_item_id')::uuid, v_home, -v_qty, 'sale',
         v_place.quantity, round(v_place.quantity - v_qty, 4), 'Put back: voided on the till');
      v_applied := v_applied || jsonb_build_object('name', v_name, 'used', v_qty);
    end if;
  end loop;

  update till_usage_cursor set until = p_until, updated_at = now() where id = 1;
  insert into till_usage_runs (since, until, applied, shortfalls)
  values (p_expected, p_until, v_applied, v_shorts);

  return jsonb_build_object('skipped', false, 'applied', v_applied, 'shortfalls', v_shorts);
end $$;

-- What Nesty shows: every open run-out, and anything closed in the last day.
create or replace function public.nesty_run_outs()
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'open')::boolean desc, x->>'opened_at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
             'item', i.name, 'unit', i.unit,
             'what', case r.kind when 'short' then 'sold more than the iPad had' else 'sold out' end,
             'short_by', r.short_by,
             'on_hand', (select coalesce(sum(p.quantity), 0)
                           from stock_placements p join stock_locations l on l.id = p.location_id and l.active
                          where p.stock_item_id = i.id),
             'opened_at', to_char(r.opened_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI'),
             'open', r.resolved_at is null,
             'resolved_at', to_char(r.resolved_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI')
           ) as x
      from stock_run_outs r join stock_items i on i.id = r.stock_item_id
     where r.resolved_at is null or r.resolved_at > now() - interval '1 day'
  ) s
$$;

-- The shortfalls recorded before storage counted, taken out of storage now.
do $$
declare
  v_s     jsonb;
  v_item  uuid;
  v_short numeric;
begin
  for v_s in
    select s from till_usage_runs r cross join lateral jsonb_array_elements(r.shortfalls) s
     where s ? 'not_on_shelves'
  loop
    select id into v_item from stock_items where name = v_s->>'name' and active limit 1;
    continue when v_item is null;
    v_short := take_sold_stock(v_item, (v_s->>'not_on_shelves')::numeric,
                               'Sold on the till (taken from storage, 18 Sep)');
    perform note_stock_level(v_item, v_short);
  end loop;
end $$;

revoke all on function public.take_sold_stock(uuid, numeric, text), public.note_stock_level(uuid, numeric),
  public.apply_till_usage(timestamptz, timestamptz, jsonb), public.nesty_run_outs()
  from public, anon, authenticated;
grant execute on function public.take_sold_stock(uuid, numeric, text), public.note_stock_level(uuid, numeric),
  public.apply_till_usage(timestamptz, timestamptz, jsonb), public.nesty_run_outs()
  to service_role;
