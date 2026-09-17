import { createAdminClient } from '@/lib/supabase/admin'
import { breakStatusesNow } from '@/lib/breaks/on-shift'
import { formatMinutes, type BreakStatus } from '@/lib/breaks/status'
import { sendPushover, type AlertRun } from './long-shifts'

/**
 * Tells the owner when a break is missed. Staff get their own reminders on the
 * tablet from an hour before; the owner hears only once a shift is past the
 * legal point without enough break, or someone clocks out saying they didn't
 * get one. Each shift alerts once (time_logs.break_alerted_at).
 */

function rule(s: BreakStatus): string {
  return `${s.requiredMinutes} min required after ${formatMinutes(s.legalAfterMinutes)}${s.youngWorker ? ', under 18' : ''}`
}

function breakSoFar(s: BreakStatus): string {
  return s.breakMinutes > 0 ? `only ${s.breakMinutes} min of break` : 'no break'
}

async function markAlerted(timeLogId: string) {
  await createAdminClient()
    .from('time_logs')
    .update({ break_alerted_at: new Date().toISOString() })
    .eq('id', timeLogId)
    .is('break_alerted_at', null)
}

/** Cron: open shifts past the legal point without enough break. */
export async function alertOverdueBreaks(): Promise<AlertRun> {
  const shifts = (await breakStatusesNow()).filter((s) => s.status === 'due' && !s.breakAlertedAt)
  const run: AlertRun = { checked: shifts.length, alerted: [], failed: [] }
  for (const s of shifts) {
    const sent = await sendPushover(
      `Break overdue: ${s.name}`,
      `${s.name} has been on shift ${formatMinutes(s.shiftMinutes)} with ${breakSoFar(s)} (${rule(s)}).`,
    )
    if (!sent) {
      run.failed.push(s.name)
      continue
    }
    await markAlerted(s.timeLogId)
    run.alerted.push(s.name)
  }
  return run
}

/** Clock-out: the person said they didn't get a break. Never blocks the clock-out. */
export async function alertMissedBreak(timeLogId: string, name: string, status: BreakStatus, reason: string | null) {
  try {
    const sent = await sendPushover(
      `Missed break: ${name}`,
      `${name} clocked out after ${formatMinutes(status.shiftMinutes)} with ${breakSoFar(status)} (${rule(status)}). ${
        reason ? `Reason: ${reason}` : 'No reason given.'
      }`,
    )
    if (sent) await markAlerted(timeLogId)
  } catch (e) {
    console.error('missed-break alert failed', e)
  }
}
