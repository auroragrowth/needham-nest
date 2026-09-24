-- Nesty reads the profit and loss (agent 09).
--
-- Two read-only functions over the pl views, so the dashboard can show the month's
-- headlines and how much is still unclassified. Service role only, like every other
-- nesty_ function. Nothing here writes, and no individual's pay is ever returned:
-- wages are a total, as the P&L shows them.

create or replace function public.nesty_pl_summary(p_from date, p_to date)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row order by row->>'month' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'month', to_char(s.month, 'YYYY-MM'),
             'sales', s.sales,
             'cost_of_sales', s.cost_of_sales,
             'gross_profit', s.gross_profit,
             'gross_profit_pct', s.gp_pct,
             'wages', s.wages,
             'wages_pct', s.wages_pct,
             'overheads', s.overheads,
             'operating_profit', s.operating_profit,
             'operating_profit_pct', s.op_pct,
             'unclassified', s.unclassified_net,
             'unclassified_lines', s.unclassified_lines,
             'close_state', s.close_state
           ) as row
    from public.v_pl_summary s
    where s.month >= date_trunc('month', p_from)::date
      and s.month <= date_trunc('month', p_to)::date
  ) rows;
$$;

-- The lines no rule could place, waiting for Paul or Ben. Oldest first, capped,
-- because this is a to-do list rather than a ledger.
create or replace function public.nesty_pl_review_queue()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'waiting', (select count(*) from public.v_pl_review_queue),
    'total', (select coalesce(round(sum(abs(amount))::numeric, 2), 0) from public.v_pl_review_queue),
    'oldest', (
      select coalesce(jsonb_agg(jsonb_build_object('date', q.date, 'payee', q.payee, 'amount', q.amount, 'source', q.source) order by q.date), '[]'::jsonb)
      from (select * from public.v_pl_review_queue order by date limit 20) q
    )
  );
$$;

revoke execute on function public.nesty_pl_summary(date, date) from public, anon, authenticated;
revoke execute on function public.nesty_pl_review_queue() from public, anon, authenticated;
grant execute on function public.nesty_pl_summary(date, date) to service_role;
grant execute on function public.nesty_pl_review_queue() to service_role;
