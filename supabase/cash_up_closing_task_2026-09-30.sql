-- The cash-up job on the closing list points at /staff/cash-up, which asks the
-- till whether the drawer has been counted and ticks the job off when it has.
--
-- Found by its link_href in code (CASH_UP_PATH in src/lib/till/cash-up.ts), the
-- same way the waste job is found, so no new column is needed.

update public.cleaning_tasks
set
  link_href = '/staff/cash-up',
  link_label = 'Cash up',
  detail = 'Counted on the till. This ticks itself off as soon as the drawer is counted there.'
where name = 'I have done the cashing up'
  and frequency = 'close';
