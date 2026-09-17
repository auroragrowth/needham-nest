import { createAdminClient } from '@/lib/supabase/admin'
import { breakStatus, isYoungWorkerToday, type BreakStatus } from './status'

export type ShiftBreak = BreakStatus & {
  timeLogId: string
  userId: string
  name: string
  clockIn: string
  breakAlertedAt: string | null
}

/** The break status of every shift open right now. */
export async function breakStatusesNow(now = new Date()): Promise<ShiftBreak[]> {
  const admin = createAdminClient()
  const { data: shifts, error } = await admin
    .from('time_logs')
    .select('id, user_id, clock_in, break_start_at, break_minutes_total, break_alerted_at')
    .is('clock_out', null)
  if (error) throw new Error(error.message)
  if (!shifts?.length) return []

  const { data: people } = await admin
    .from('profiles')
    .select('id, name, date_of_birth')
    .in('id', shifts.map((s) => s.user_id))
  const byId = new Map((people ?? []).map((p) => [p.id, p]))

  return shifts.map((s) => {
    const person = byId.get(s.user_id)
    return {
      ...breakStatus({
        clockIn: s.clock_in,
        now,
        breakMinutesTotal: s.break_minutes_total,
        breakStartAt: s.break_start_at,
        youngWorker: isYoungWorkerToday(person?.date_of_birth, now),
      }),
      timeLogId: s.id,
      userId: s.user_id,
      name: person?.name ?? 'Someone',
      clockIn: s.clock_in,
      breakAlertedAt: s.break_alerted_at,
    }
  })
}

/** The break status of one person's open shift, or null if they aren't on shift. */
export async function breakStatusFor(profileId: string, now = new Date()): Promise<ShiftBreak | null> {
  return (await breakStatusesNow(now)).find((s) => s.userId === profileId) ?? null
}
