import { createAdminClient } from '@/lib/supabase/admin'
import { syncCashUpTick } from '@/lib/till/cash-up'

/**
 * Closing-up rules.
 *
 * The person who leaves last is the one closing up, so they're the only one
 * held to the closing list — anyone finishing mid-day (with colleagues still
 * on shift) clocks out freely.
 *
 * The cash-up job answers to the till: it is ticked off here the moment the
 * drawer has been counted there, so it holds the last person back until it
 * really has been (src/lib/till/cash-up.ts).
 */

export type ClosingStatus = {
  /** Nobody else is clocked in, so this person is closing up. */
  isLastOnShift: boolean
  /** Active closing tasks with no tick against them today. */
  outstanding: { id: string; name: string }[]
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function getClosingStatus(
  profileId: string,
): Promise<ClosingStatus> {
  const admin = createAdminClient()

  // Before deciding what's outstanding: if the till says the drawer has been
  // counted, that job is done and the log should say so.
  await syncCashUpTick(profileId)

  const [{ count: othersOnShift }, { data: closeTasks }, { data: logs }] =
    await Promise.all([
      admin
        .from('time_logs')
        .select('*', { count: 'exact', head: true })
        .is('clock_out', null)
        .neq('user_id', profileId),
      admin
        .from('cleaning_tasks')
        .select('id, name')
        .eq('active', true)
        .eq('frequency', 'close')
        .order('sort_order')
        .order('name'),
      admin
        .from('cleaning_log')
        .select('task_id')
        .gte('completed_at', startOfTodayIso()),
    ])

  const done = new Set((logs ?? []).map((l) => l.task_id))

  return {
    isLastOnShift: (othersOnShift ?? 0) === 0,
    outstanding: (closeTasks ?? []).filter((t) => !done.has(t.id)),
  }
}

/** True when this person must finish the closing list before signing out. */
export function isBlocked(status: ClosingStatus): boolean {
  return status.isLastOnShift && status.outstanding.length > 0
}
