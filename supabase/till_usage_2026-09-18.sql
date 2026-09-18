-- Applied 18 Sep 2026 as migration till_usage.
--
-- The café app holds the stock; the till says what selling used up
-- (GET /api/hub/report/usage on the till). This takes that off the shelves:
-- the café zone first, then the kitchen, never below zero. Storage is left
-- alone — nothing is sold straight out of the store room.
--
-- One function does the whole window in one transaction, and only if the
-- cursor is where the caller last saw it, so an overlapping or retried cron run
-- can never take the same sales off twice.

-- A sale is a movement like any other, so it is logged with the rest.
alter table public.stock_location_moves drop constraint if exists stock_location_moves_kind_check;
alter table public.stock_location_moves add constraint stock_location_moves_kind_check
  check (kind in ('move', 'adjust', 'receive', 'waste', 'sale'));

-- Where the last read of the till's usage feed ended. One row.
create table if not exists public.till_usage_cursor (
  id         int primary key default 1 check (id = 1),
  until      timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Every window applied: what came off, and anything that couldn't because the
-- shelves said there was none — which means a count is wrong somewhere.
create table if not exists public.till_usage_runs (
  id         uuid primary key default gen_random_uuid(),
  since      timestamptz,
  until      timestamptz not null,
  applied    jsonb not null default '[]',
  shortfalls jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.till_usage_cursor enable row level security;
alter table public.till_usage_runs enable row level security;
revoke all on public.till_usage_cursor, public.till_usage_runs from anon, authenticated;

-- p_items: [{"stock_item_id": uuid, "quantity": n}] in the café's own units
-- (bags, packs, each). Positive was used; negative came back from a void.
create or replace function public.apply_till_usage(p_expected timestamptz, p_until timestamptz, p_items jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cursor    timestamptz;
  v_item      jsonb;
  v_left      numeric;
  v_take      numeric;
  v_place     record;
  v_home      uuid;
  v_applied   jsonb := '[]';
  v_short     jsonb := '[]';
  v_name      text;
begin
  if p_expected is null then
    -- The very first run. Only one caller can create the cursor, so only one
    -- can apply this window.
    insert into till_usage_cursor (id, until) values (1, p_until) on conflict (id) do nothing;
    if not found then
      return jsonb_build_object('skipped', true, 'cursor', (select until from till_usage_cursor where id = 1));
    end if;
  else
    select until into v_cursor from till_usage_cursor where id = 1 for update;
    -- Someone else got here first, or this is a retry of a window already done.
    if v_cursor is distinct from p_expected then
      return jsonb_build_object('skipped', true, 'cursor', v_cursor);
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_left := round((v_item->>'quantity')::numeric, 4);
    continue when v_left = 0;
    select name into v_name from stock_items where id = (v_item->>'stock_item_id')::uuid;

    if v_left > 0 then
      for v_place in
        select p.id, p.location_id, p.quantity
          from stock_placements p
          join stock_locations l on l.id = p.location_id
         where p.stock_item_id = (v_item->>'stock_item_id')::uuid
           and l.active and l.zone in ('cafe', 'kitchen') and p.quantity > 0
         order by case l.zone when 'cafe' then 0 else 1 end, l.sort_order, l.name
           for update of p
      loop
        exit when v_left <= 0;
        v_take := least(v_left, v_place.quantity);
        update stock_placements
           set quantity = round(v_place.quantity - v_take, 4), updated_at = now()
         where id = v_place.id;
        insert into stock_location_moves
          (stock_item_id, from_location_id, quantity, kind, previous_quantity, new_quantity, notes)
        values
          ((v_item->>'stock_item_id')::uuid, v_place.location_id, v_take, 'sale',
           v_place.quantity, round(v_place.quantity - v_take, 4), 'Sold on the till');
        v_left := v_left - v_take;
      end loop;

      v_applied := v_applied || jsonb_build_object('name', v_name, 'used', round((v_item->>'quantity')::numeric, 4));
      if v_left > 0.0005 then
        v_short := v_short || jsonb_build_object('name', v_name, 'not_on_shelves', round(v_left, 4));
      end if;
    else
      -- A void: it goes back where the item lives in the café, else the
      -- kitchen, else the first café location.
      select p.location_id into v_home
        from stock_placements p
        join stock_locations l on l.id = p.location_id
       where p.stock_item_id = (v_item->>'stock_item_id')::uuid and l.active and l.zone in ('cafe', 'kitchen')
       order by case l.zone when 'cafe' then 0 else 1 end, l.sort_order, l.name
       limit 1;
      if v_home is null then
        select id into v_home from stock_locations
         where active and zone = 'cafe' order by sort_order, name limit 1;
      end if;
      if v_home is null then
        v_short := v_short || jsonb_build_object('name', v_name, 'nowhere_to_return', -v_left);
        continue;
      end if;

      insert into stock_placements (stock_item_id, location_id, quantity)
      values ((v_item->>'stock_item_id')::uuid, v_home, 0)
      on conflict (stock_item_id, location_id) do nothing;
      select id, quantity into v_place from stock_placements
       where stock_item_id = (v_item->>'stock_item_id')::uuid and location_id = v_home
         for update;
      update stock_placements set quantity = round(v_place.quantity - v_left, 4), updated_at = now()
       where id = v_place.id;
      insert into stock_location_moves
        (stock_item_id, to_location_id, quantity, kind, previous_quantity, new_quantity, notes)
      values
        ((v_item->>'stock_item_id')::uuid, v_home, -v_left, 'sale',
         v_place.quantity, round(v_place.quantity - v_left, 4), 'Put back: voided on the till');
      v_applied := v_applied || jsonb_build_object('name', v_name, 'used', round(v_left, 4));
    end if;
  end loop;

  update till_usage_cursor set until = p_until, updated_at = now() where id = 1;
  insert into till_usage_runs (since, until, applied, shortfalls)
  values (p_expected, p_until, v_applied, v_short);

  return jsonb_build_object('skipped', false, 'applied', v_applied, 'shortfalls', v_short);
end $$;

revoke all on function public.apply_till_usage(timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_till_usage(timestamptz, timestamptz, jsonb) to service_role;
