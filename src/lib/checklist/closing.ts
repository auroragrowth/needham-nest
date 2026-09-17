import { createAdminClient } from '@/lib/supabase/admin'
import { londonParts } from '@/lib/stock/wastage'

/**
 * Closing-up rules.
 *
 * The person who leaves last is the one closing up, so they're the only one
 * held to the closing list — anyone finishing mid-day (with colleagues still
 * on shift) clocks out freely.
 */

export type ClosingStatus = {
  /** Nobody else is clocked in, so this person is closing up. */
  isLastOnShift: boolean
  /** Active closing tasks with no tick against them today. */
  outstanding: { id: string; name: string }[]
  /** Someone has confirmed today's waste is all logged (or that there was none). */
  wasteConfirmed: boolean
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

  const [{ count: othersOnShift }, { data: closeTasks }, { data: logs }, { data: wasteCheck }] =
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
      admin
        .from('waste_checks')
        .select('day')
        .eq('day', londonParts(new Date()).day)
        .maybeSingle(),
    ])

  const done = new Set((logs ?? []).map((l) => l.task_id))

  return {
    isLastOnShift: (othersOnShift ?? 0) === 0,
    outstanding: (closeTasks ?? []).filter((t) => !done.has(t.id)),
    wasteConfirmed: Boolean(wasteCheck),
  }
}

/** True when this person must finish the closing list before signing out. */
export function isBlocked(status: ClosingStatus): boolean {
  return status.isLastOnShift && status.outstanding.length > 0
}

/**
 * True when this person is closing up and today's waste isn't confirmed.
 * Unlike the rest of the closing list this has no "sign out anyway": logging
 * the waste, or confirming there was none, takes a moment.
 */
export function wasteBlocked(status: ClosingStatus): boolean {
  return status.isLastOnShift && !status.wasteConfirmed
}
