-- Break reminders, applied 17 Sep 2026 (migration break_alerts).
--
-- Staff are reminded on the tablet from an hour before a break is legally due;
-- the owner is alerted (Pushover from /api/cron/breaks, and Nesty) once a shift
-- passes the legal point without enough break, or when someone clocks out
-- saying they didn't get one. This column records that the owner was told, so
-- each shift alerts once.
--
-- Nesty's report, nesty_breaks_due(), is in nesty_read_functions.sql.

alter table public.time_logs add column if not exists break_alerted_at timestamptz;

comment on column public.time_logs.break_alerted_at is
  'When the owner was alerted that this shift passed the legal break point without enough break. Null = not alerted.';
