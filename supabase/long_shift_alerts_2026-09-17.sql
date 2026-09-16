-- Long-shift alerts, applied 17 Sep 2026 (migration long_shift_alerts).
--
-- The owner is alerted when any shift passes 10 hours: a Pushover push from
-- /api/cron/long-shifts every 15 minutes, and a card in Nesty. This column
-- records that the push went out, so each shift alerts once.
--
-- The report both of them read, nesty_long_shifts(), and the missing-clock-outs
-- threshold change from 12 to 10 hours are in nesty_read_functions.sql.

alter table public.time_logs add column if not exists long_shift_alerted_at timestamptz;

comment on column public.time_logs.long_shift_alerted_at is
  'When the owner was alerted (Pushover) that this shift passed 10 hours. Null = not alerted.';
