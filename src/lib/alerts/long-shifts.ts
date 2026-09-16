import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Tells the owner's phone when anyone's shift passes 10 hours.
 *
 * Forgotten clock-outs have been paid through payroll before anyone noticed,
 * so the cron (/api/cron/long-shifts, every 15 minutes) pushes a Pushover alert
 * for each shift over 10 hours of clock time. Breaks are not deducted: this is
 * "on shift for", so a runaway alerts as early as possible. Each shift alerts
 * once; a failed send is retried on the next run.
 */

/** One row of nesty_long_shifts(), the same report Nesty reads. Times are UK local. */
export type LongShift = {
  time_log_id: string
  name: string
  clock_in: string // 'YYYY-MM-DD HH:MM'
  clock_out: string | null
  still_clocked_in: boolean
  on_break: boolean
  hours_so_far: number
  rota_end_that_day: string | null
  suggested_clock_out: string | null
  alerted_at: string | null
}

export async function findLongShifts(): Promise<LongShift[]> {
  const { data, error } = await createAdminClient().rpc('nesty_long_shifts')
  if (error) throw new Error(error.message)
  return (data ?? []) as LongShift[]
}

function duration(hours: number): string {
  const minutes = Math.round(Number(hours) * 60)
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

function dayLabel(stamp: string): string {
  return new Date(`${stamp.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function describe(shift: LongShift): { title: string; message: string } {
  const since = shift.clock_in.slice(11)
  const rota = shift.rota_end_that_day
    ? `Rota ended ${shift.rota_end_that_day}.`
    : 'No rota shift that day.'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const startedToday = shift.clock_in.slice(0, 10) === today
  const message = shift.still_clocked_in
    ? `${shift.name} has been clocked in ${duration(shift.hours_so_far)} (since ${since}${startedToday ? '' : ` on ${dayLabel(shift.clock_in)}`}). ${rota}`
    : `${shift.name} worked ${duration(shift.hours_so_far)} on ${dayLabel(shift.clock_in)} (${since}–${shift.clock_out!.slice(11)}). ${rota}`
  return { title: `Long shift: ${shift.name}`, message }
}

export function pushoverConfigured(): boolean {
  return Boolean(process.env.PUSHOVER_APP_TOKEN?.trim() && process.env.PUSHOVER_USER_KEY?.trim())
}

/** True only when Pushover accepted the message. */
export async function sendPushover(title: string, message: string): Promise<boolean> {
  const token = process.env.PUSHOVER_APP_TOKEN?.trim()
  const user = process.env.PUSHOVER_USER_KEY?.trim()
  if (!token || !user) return false
  const res = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    body: new URLSearchParams({ token, user, title, message }),
  })
  const body = (await res.json().catch(() => null)) as { status?: number } | null
  return res.ok && body?.status === 1
}

export type AlertRun = { checked: number; alerted: string[]; failed: string[] }

export async function alertLongShifts(): Promise<AlertRun> {
  const shifts = (await findLongShifts()).filter((s) => !s.alerted_at)
  const admin = createAdminClient()
  const run: AlertRun = { checked: shifts.length, alerted: [], failed: [] }
  for (const shift of shifts) {
    const { title, message } = describe(shift)
    if (!(await sendPushover(title, message))) {
      run.failed.push(shift.name)
      continue
    }
    // Only after Pushover accepted it, so a failed send retries next run.
    await admin
      .from('time_logs')
      .update({ long_shift_alerted_at: new Date().toISOString() })
      .eq('id', shift.time_log_id)
      .is('long_shift_alerted_at', null)
    run.alerted.push(shift.name)
  }
  return run
}
