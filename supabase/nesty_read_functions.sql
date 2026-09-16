-- ============================================================================
-- Nesty: read-only reporting functions
--
-- Nesty is the owner's desktop assistant. It reaches this data only through
-- GET /api/nesty/<name>, behind NESTY_READ_TOKEN, and that route calls these
-- functions with the service-role key.
--
-- Rules every function here follows:
--   * Read only: `stable`, no writes.
--   * Only the service role may execute them (revoked from public, anon,
--     authenticated at the bottom of this file).
--   * Days are UK days (Europe/London), per the runbook's first ground rule.
--   * Never returned: PIN hashes, contact or address details, bank details,
--     NI numbers, dates of birth, health details, raw hourly rates or
--     salaries, tax codes and deductions, feedback comments, accident
--     person or description, storage paths.
--   * Money is numeric pounds, as everywhere in this app.
--
-- Idempotent: safe to run again after a change.
-- ============================================================================

-- UK-local midnight at the start of a date, as an instant.
create or replace function public.nesty_day_start(p_day date)
returns timestamptz language sql immutable as $$
  select (p_day::timestamp at time zone 'Europe/London')
$$;

-- An instant shown as UK local wall-clock time.
create or replace function public.nesty_local(p_ts timestamptz)
returns text language sql stable as $$
  select to_char(p_ts at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI')
$$;

create or replace function public.nesty_london_today()
returns date language sql stable as $$
  select (now() at time zone 'Europe/London')::date
$$;

-- ------------------------------------------------------------ shifts, people

create or replace function public.nesty_clocked_in_now()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name,
           'clocked_in', nesty_local(t.clock_in),
           'on_break', t.break_start_at is not null,
           'break_minutes_so_far', coalesce(t.break_minutes_total, 0)
         ) order by t.clock_in), '[]'::jsonb)
    from time_logs t join profiles p on p.id = t.user_id
   where t.clock_out is null
$$;

create or replace function public.nesty_timesheets(p_from date, p_to date)
returns jsonb language sql stable as $$
  with shifts as (
    select p.name,
           (t.clock_in at time zone 'Europe/London')::date as day,
           t.clock_in, t.clock_out,
           coalesce(t.break_minutes_total, 0)
             + case when t.clock_out is null and t.break_start_at is not null
                    then extract(epoch from now() - t.break_start_at) / 60 else 0 end as break_minutes,
           t.notes
      from time_logs t join profiles p on p.id = t.user_id
     where t.clock_in >= nesty_day_start(p_from)
       and t.clock_in <  nesty_day_start(p_to + 1)
  ), hours as (
    select *, greatest(0, extract(epoch from coalesce(clock_out, now()) - clock_in) / 3600 - break_minutes / 60) as net_hours
      from shifts
  )
  select jsonb_build_object(
    'shifts', coalesce((select jsonb_agg(jsonb_build_object(
        'name', name, 'day', day,
        'clock_in', nesty_local(clock_in),
        'clock_out', case when clock_out is null then null else nesty_local(clock_out) end,
        'still_clocked_in', clock_out is null,
        'break_minutes', round(break_minutes::numeric, 0),
        'net_hours', round(net_hours::numeric, 2),
        'notes', notes) order by clock_in) from hours), '[]'::jsonb),
    'totals_by_person', coalesce((select jsonb_agg(x order by x->>'name') from (
        select jsonb_build_object('name', name, 'shifts', count(*), 'net_hours', round(sum(net_hours)::numeric, 2)) as x
          from hours group by name) s), '[]'::jsonb),
    'note', 'Net hours are after breaks, as on the staffing cost and payslip pages. /manager/timesheets shows hours before breaks.'
  )
$$;

create or replace function public.nesty_missing_clock_outs()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name,
           'clock_in', nesty_local(t.clock_in),
           'clock_out', case when t.clock_out is null then null else nesty_local(t.clock_out) end,
           'problem', case when t.clock_out is null then 'never clocked out'
                           else 'shift longer than 12 hours' end,
           'rota_end_that_day', (select to_char(r.end_time, 'HH24:MI') from rota_shifts r
                                  where r.staff_user_id = t.user_id
                                    and r.date = (t.clock_in at time zone 'Europe/London')::date
                                  order by r.end_time desc limit 1)
         ) order by t.clock_in desc), '[]'::jsonb)
    from time_logs t join profiles p on p.id = t.user_id
   where (t.clock_out is null and t.clock_in < nesty_day_start(nesty_london_today()))
      or (t.clock_out is not null and t.clock_out - t.clock_in > interval '12 hours'
          and t.clock_in >= now() - interval '60 days')
$$;

create or replace function public.nesty_rota(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', r.date, 'weekday', to_char(r.date, 'Dy'),
           'name', p.name,
           'start', to_char(r.start_time, 'HH24:MI'), 'end', to_char(r.end_time, 'HH24:MI'),
           'break_minutes', r.break_minutes,
           'published', r.published,
           'notes', r.notes
         ) order by r.date, r.start_time, p.name), '[]'::jsonb)
    from rota_shifts r join profiles p on p.id = r.staff_user_id
   where r.date between p_from and p_to
$$;

create or replace function public.nesty_leave(p_from date, p_to date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'leave_id', l.id,
           'name', p.name, 'kind', l.kind::text,
           'start_date', l.start_date, 'end_date', l.end_date,
           'status', l.status::text,
           'requested', nesty_local(l.requested_at),
           'decided', case when l.decided_at is null then null else nesty_local(l.decided_at) end,
           'annual_leave_days', p.annual_leave_days
         ) order by l.start_date), '[]'::jsonb)
    from leave_requests l join profiles p on p.id = l.staff_user_id
   where l.start_date <= p_to and l.end_date >= p_from
$$;

-- Unpublished rota shifts for a range, so Nesty can show what publishing would do.
create or replace function public.nesty_rota_drafts(p_from date, p_to date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'drafts', count(*),
    'shifts', coalesce(jsonb_agg(jsonb_build_object('date', r.date, 'name', p.name, 'start', to_char(r.start_time, 'HH24:MI'), 'end', to_char(r.end_time, 'HH24:MI')) order by r.date, r.start_time), '[]'::jsonb)
  )
    from rota_shifts r join profiles p on p.id = r.staff_user_id
   where r.date between p_from and p_to and not r.published
$$;

create or replace function public.nesty_availability(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', a.date, 'weekday', to_char(a.date, 'Dy'), 'name', p.name,
           'from', coalesce(to_char(a.start_time, 'HH24:MI'), 'all day'),
           'to', coalesce(to_char(a.end_time, 'HH24:MI'), 'all day')
         ) order by a.date, p.name), '[]'::jsonb)
    from staff_availability a join profiles p on p.id = a.staff_user_id
   where a.date between p_from and p_to and p.active and p.on_rota
$$;

create or replace function public.nesty_staff_list(p_include_inactive boolean default false)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name, 'role', role::text, 'active', active,
           'employment_type', employment_type,
           'on_rota', on_rota, 'payroll_included', payroll_included, 'manager_access', manager_access,
           'start_date', start_date, 'probation_end_date', probation_end_date,
           'contracted_weekly_hours', contracted_weekly_hours, 'annual_leave_days', annual_leave_days,
           'onboarded', onboarding_completed_at is not null
         ) order by active desc, name), '[]'::jsonb)
    from profiles
   where p_include_inactive or active
$$;

-- ------------------------------------------------- checklists, food safety

create or replace function public.nesty_checklist_status(p_date date)
returns jsonb language sql stable as $$
  with ticks as (
    select distinct on (l.task_id) l.task_id, l.completed_at, p.name
      from cleaning_log l left join profiles p on p.id = l.user_id
     where l.completed_at >= nesty_day_start(p_date)
       and l.completed_at <  nesty_day_start(p_date + 1)
     order by l.task_id, l.completed_at
  )
  select jsonb_build_object(
    'date', p_date,
    'tasks', coalesce(jsonb_agg(jsonb_build_object(
        'list', t.frequency::text, 'area', t.area, 'task', t.name,
        'done', k.task_id is not null,
        'done_at', case when k.completed_at is null then null else nesty_local(k.completed_at) end,
        'done_by', k.name
      ) order by t.frequency, t.sort_order, t.name), '[]'::jsonb),
    'not_done', count(*) filter (where k.task_id is null),
    'note', 'Clock in and sign out are shown on the staff checklist but come from time logs, not from these tasks.'
  )
    from cleaning_tasks t left join ticks k on k.task_id = t.id
   where t.active
$$;

create or replace function public.nesty_temperature_checks(p_from date, p_to date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'reading_id', l.id,
           'appliance', a.name, 'kind', a.kind::text, 'location', a.location,
           'recorded', nesty_local(l.recorded_at),
           'temperature', l.temperature,
           'target_min', l.target_min_snapshot, 'target_max', l.target_max_snapshot,
           'in_range', l.in_range,
           'corrective_action', l.corrective_action,
           'by', p.name
         ) order by l.recorded_at), '[]'::jsonb)
    from temperature_logs l
    join appliances a on a.id = l.appliance_id
    left join profiles p on p.id = l.user_id
   where l.recorded_at >= nesty_day_start(p_from)
     and l.recorded_at <  nesty_day_start(p_to + 1)
$$;

create or replace function public.nesty_temperature_missed(p_from date, p_to date)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'missed', coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'weekday', to_char(d.day, 'Dy'), 'appliance', a.name)
                        order by d.day, a.name), '[]'::jsonb),
    'note', 'Counted as missed when an active appliance has no reading on that UK day, the way the compliance page does. No required check frequency is stored.'
  )
    from generate_series(p_from, least(p_to, nesty_london_today()), interval '1 day') d(day)
    cross join appliances a
   where a.active
     and not exists (select 1 from temperature_logs l
                      where l.appliance_id = a.id
                        and l.recorded_at >= nesty_day_start(d.day::date)
                        and l.recorded_at <  nesty_day_start(d.day::date + 1))
$$;

create or replace function public.nesty_cooked_meats(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'item', c.item_name, 'temperature', c.temperature, 'in_range', c.in_range,
           'corrective_action', c.corrective_action,
           'recorded', nesty_local(c.recorded_at), 'by', p.name
         ) order by c.recorded_at), '[]'::jsonb)
    from cooked_meat_checks c left join profiles p on p.id = c.user_id
   where c.recorded_at >= nesty_day_start(p_from)
     and c.recorded_at <  nesty_day_start(p_to + 1)
$$;

-- Who was hurt and how is health data, so it stays out.
create or replace function public.nesty_accidents(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'occurred', nesty_local(occurred_at),
           'riddor_reportable', riddor_reportable,
           'reported', case when reported_at is null then null else nesty_local(reported_at) end,
           'action_taken', action_taken
         ) order by occurred_at), '[]'::jsonb)
    from accident_log
   where occurred_at >= nesty_day_start(p_from)
     and occurred_at <  nesty_day_start(p_to + 1)
$$;

-- -------------------------------------------------------------------- stock

create or replace function public.nesty_stock_levels(p_search text default null)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(x order by x->>'item'), '[]'::jsonb) from (
    select jsonb_build_object(
             'item', i.name, 'category', i.category, 'unit', i.unit,
             'on_hand', coalesce(sum(sp.quantity) filter (where sl.active), 0),
             'par_level', i.par_level, 'supplier', i.supplier_name, 'cost_price', i.cost_price,
             'where', coalesce(jsonb_agg(jsonb_build_object('location', sl.name, 'quantity', sp.quantity))
                               filter (where sl.active and sp.quantity <> 0), '[]'::jsonb)
           ) as x
      from stock_items i
      left join stock_placements sp on sp.stock_item_id = i.id
      left join stock_locations sl on sl.id = sp.location_id
     where i.active
       and (p_search is null or i.name ilike '%' || p_search || '%' or i.category ilike '%' || p_search || '%')
     group by i.id
  ) s
$$;

create or replace function public.nesty_stock_alerts()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(x order by (x->>'short_by')::numeric desc), '[]'::jsonb) from (
    select jsonb_build_object('item', i.name, 'unit', i.unit, 'on_hand', t.total, 'par_level', i.par_level,
                              'short_by', i.par_level - t.total, 'supplier', i.supplier_name) as x
      from stock_items i
      cross join lateral (
        select coalesce(sum(sp.quantity), 0) as total
          from stock_placements sp join stock_locations sl on sl.id = sp.location_id and sl.active
         where sp.stock_item_id = i.id) t
     where i.active and i.par_level is not null and t.total <= i.par_level
  ) s
$$;

-- What to order, by supplier, worked out the way /owner/order-pad does.
create or replace function public.nesty_order_pad()
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with current_stock as (
    select i.id, i.name, i.unit, i.category, i.par_level, i.cost_price,
           coalesce(i.supplier_name, '(no supplier)') as supplier,
           coalesce(
             (select sum(sp.quantity) from stock_placements sp where sp.stock_item_id = i.id having count(*) > 0),
             (select c.on_hand from stock_counts c where c.stock_item_id = i.id order by c.date desc, c.created_at desc limit 1)
           ) as on_hand
      from stock_items i
     where i.active and i.par_level is not null
  ), needed as (
    select *, case when on_hand is null then null else greatest(par_level - on_hand, 0) end as suggested
      from current_stock
     where on_hand is null or on_hand < par_level
  )
  select coalesce(jsonb_agg(s order by s->>'supplier'), '[]'::jsonb) from (
    select jsonb_build_object(
      'supplier', supplier,
      'items', jsonb_agg(jsonb_build_object(
                 'item', name, 'unit', unit, 'category', category,
                 'on_hand', on_hand, 'par_level', par_level,
                 'suggested_quantity', suggested,
                 'never_counted', on_hand is null,
                 'estimated_cost', case when suggested is null or cost_price is null then null else round(suggested * cost_price, 2) end
               ) order by category, name)
    ) as s
      from needed group by supplier
  ) grouped
$$;

create or replace function public.nesty_wastage(p_from date, p_to date)
returns jsonb language sql stable as $$
  with w as (
    select m.date, i.name as item, i.unit, m.quantity, m.unit_cost,
           round(m.quantity * coalesce(m.unit_cost, 0), 2) as cost,
           m.wastage_reason::text as reason, p.name as by
      from stock_movements m
      join stock_items i on i.id = m.stock_item_id
      left join profiles p on p.id = m.user_id
     where m.wastage_reason is not null and m.date between p_from and p_to
  )
  select jsonb_build_object(
    'entries', coalesce((select jsonb_agg(to_jsonb(w) order by w.date) from w), '[]'::jsonb),
    'by_reason', coalesce((select jsonb_agg(jsonb_build_object('reason', reason, 'entries', n, 'cost', cost))
                             from (select reason, count(*) n, sum(cost) cost from w group by reason) r), '[]'::jsonb),
    'total_cost', coalesce((select sum(cost) from w), 0)
  )
$$;

create or replace function public.nesty_deliveries(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', d.date, 'supplier', s.name, 'total', d.total, 'reference', d.reference,
           'lines', coalesce(jsonb_array_length(d.items), 0)
         ) order by d.date), '[]'::jsonb)
    from deliveries d left join suppliers s on s.id = d.supplier_id
   where d.date between p_from and p_to
$$;

create or replace function public.nesty_shopping_list(p_include_done boolean default false)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'item', l.item, 'notes', l.notes, 'added', nesty_local(l.added_at), 'added_by', p.name, 'done', l.done
         ) order by l.done, l.added_at desc), '[]'::jsonb)
    from shopping_list l left join profiles p on p.id = l.added_by
   where p_include_done or not l.done
$$;

-- -------------------------------------------------------------------- money

create or replace function public.nesty_takings(p_from date, p_to date)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source', source, 'amount', amount) order by amount desc)
                             from (select source::text, sum(amount) amount from takings
                                    where date between p_from and p_to group by source) s), '[]'::jsonb),
    'total', coalesce((select sum(amount) from takings where date between p_from and p_to), 0),
    'note', 'This is the takings entered in the café app. Live till sales are a separate system.'
  )
$$;

create or replace function public.nesty_expenses(p_from date, p_to date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('category', c, 'amount', a) order by a desc)
                               from (select category::text c, sum(amount) a from expenses
                                      where date between p_from and p_to group by category) s), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
                           'expense_id', id,
                           'date', date, 'category', category::text, 'vendor', vendor, 'amount', amount,
                           'payment_method', payment_method, 'paid_in_cash', paid_in_cash,
                           'reconciled', reconciled_at is not null) order by date)
                           from expenses where date between p_from and p_to), '[]'::jsonb),
    'total', coalesce((select sum(amount) from expenses where date between p_from and p_to), 0),
    'note', 'Deliveries already appear here as expenses; do not add them again.'
  )
$$;

create or replace function public.nesty_invoices_outstanding()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'invoice', invoice_number, 'customer', customer_snapshot->>'name',
           'date', date, 'due_date', due_date, 'total', total, 'status', status::text,
           'overdue', status::text = 'overdue' or (status::text = 'sent' and due_date < nesty_london_today())
         ) order by due_date nulls last), '[]'::jsonb)
    from invoices
   where status::text <> 'paid'
$$;

create or replace function public.nesty_pl(p_from date, p_to date)
returns jsonb language sql stable as $$
  with figures as (
    select coalesce((select sum(amount) from takings where date between p_from and p_to), 0) as takings,
           coalesce((select sum(amount) from expenses where date between p_from and p_to), 0) as expenses,
           coalesce((select ct_rate from settings limit 1), 19) as ct_rate,
           coalesce((select sum(amount) from pot_allocations where pot::text = 'tax' and date <= p_to), 0) as tax_pot
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'takings', takings, 'expenses', expenses,
    'profit', takings - expenses,
    'corporation_tax_rate', ct_rate,
    'corporation_tax_estimate', round(greatest(0, (takings - expenses) * ct_rate / 100), 2),
    'profit_after_tax', round((takings - expenses) - greatest(0, (takings - expenses) * ct_rate / 100), 2),
    'tax_pot_balance', tax_pot,
    'note', 'Calculated as the P&L page does: takings entered in the app minus expenses. Staffing cost and payroll are not included unless they were recorded as expenses.'
  ) from figures
$$;

create or replace function public.nesty_cash(p_from date, p_to date)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'counts', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'counted', counted, 'expected', expected, 'difference', difference) order by date)
                          from cash_counts where date between p_from and p_to), '[]'::jsonb),
    'movements', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'direction', direction::text, 'amount', amount, 'reason', reason) order by date)
                             from cash_movements where date between p_from and p_to), '[]'::jsonb)
  )
$$;

create or replace function public.nesty_tips(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', t.date, 'total_collected', t.total_collected,
           'shares', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'hours', (d->>'hours')::numeric, 'amount', (d->>'amount')::numeric)), '[]'::jsonb)
                        from jsonb_array_elements(coalesce(t.distribution, '[]'::jsonb)) d
                        left join profiles p on p.id::text = d->>'user_id')
         ) order by t.date), '[]'::jsonb)
    from tip_pools t
   where t.date between p_from and p_to
$$;

create or replace function public.nesty_payroll_runs(p_from date default null, p_to date default null)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'period', period_label, 'type', run_type, 'pay_date', pay_date, 'headcount', headcount,
           'total_gross', total_gross, 'tax_deducted', tax_deducted,
           'employee_nic', employee_nic, 'employer_nic', employer_nic,
           'total_net', total_net, 'hmrc_due', hmrc_due, 'total_outlay', total_outlay,
           'status', status
         ) order by pay_date desc), '[]'::jsonb)
    from payroll_runs
   where (p_from is null or pay_date >= p_from) and (p_to is null or pay_date <= p_to)
$$;

create or replace function public.nesty_payslip_totals(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name, 'period_from', s.period_from, 'period_to', s.period_to, 'pay_date', s.pay_date,
           'hours', s.hours_worked, 'gross_pay', s.gross_pay, 'net_pay', s.net_pay,
           'paid', s.paid_at is not null
         ) order by s.period_to, p.name), '[]'::jsonb)
    from payslips s join profiles p on p.id = s.staff_id
   where s.period_to between p_from and p_to
$$;

create or replace function public.nesty_wage_payments(p_from date, p_to date)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.name, 'period_start', w.period_start, 'period_end', w.period_end,
           'hours', w.hours, 'gross', w.gross, 'paid_on', w.paid_at, 'paid_via', w.paid_via
         ) order by w.period_end, p.name), '[]'::jsonb)
    from wage_payments w join profiles p on p.id = w.staff_user_id
   where w.period_end >= p_from and w.period_start <= p_to
$$;

create or replace function public.nesty_bank_unreconciled(p_from date, p_to date)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'transactions', coalesce(jsonb_agg(jsonb_build_object('bank_transaction_id', id, 'date', date, 'description', description, 'amount', amount, 'source', source) order by date), '[]'::jsonb),
    'count', count(*),
    'money_in', coalesce(sum(amount) filter (where amount > 0), 0),
    'money_out', coalesce(sum(amount) filter (where amount < 0), 0)
  )
    from bank_transactions
   where matched_expense_id is null and matched_takings_id is null
     and date between p_from and p_to
$$;

-- Counts and averages only. The comments are anonymous free text and stay in
-- the app.
create or replace function public.nesty_feedback_summary(p_from date, p_to date)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'responses', count(*),
    'average_cafe_rating', round(avg(cafe_rating), 1),
    'average_products_rating', round(avg(products_rating), 1),
    'average_prices_rating', round(avg(prices_rating), 1),
    'latest', case when max(submitted_at) is null then null else nesty_local(max(submitted_at)) end,
    'rounds', (select coalesce(jsonb_agg(jsonb_build_object('round', round, 'submitted', s, 'outstanding', o) order by round), '[]'::jsonb)
                 from (select round, count(*) filter (where submitted) s, count(*) filter (where not submitted) o
                         from feedback_tracking group by round) r),
    'note', 'Comments are not shared with Nesty. Read them in the app.'
  )
    from staff_feedback
   where submitted_at >= nesty_day_start(p_from)
     and submitted_at <  nesty_day_start(p_to + 1)
$$;

-- ------------------------------------------------------------------ access
-- Functions in public are executable by everyone by default. These must only
-- ever be run by the server.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'nesty\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
