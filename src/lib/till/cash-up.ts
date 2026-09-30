import { createAdminClient } from '@/lib/supabase/admin'

/**
 * "I have done the cashing up", answered by the till rather than by a tap.
 *
 * The drawer is counted on the till, not here — so the closing list asks the
 * till whether today's count has been done, and ticks the job off itself when
 * it has. Nobody can tick it early, and nobody has to remember to tick it late.
 *
 * The till's answer carries no money: only whether the day was closed, when,
 * and the name that was signed on (/api/hub/report/cash-up). Needs TILL_URL and
 * TILL_STOCK_TOKEN, the same pair the usage feed uses.
 *
 * If the till can't be reached, this fails open — `asked` comes back false, the
 * job stays tickable by hand, and nobody is trapped in the café by a wifi drop.
 */

/** The task on the closing list this answers for, found by where it links. */
export const CASH_UP_PATH = '/staff/cash-up'

export type TillCashUp = {
  /** The till actually answered. False means unconfigured or unreachable. */
  asked: boolean
  cashedUp: boolean
  /** The name signed on at the till when the drawer was counted. */
  by: string | null
  at: string | null
}

const UNASKED: TillCashUp = { asked: false, cashedUp: false, by: null, at: null }

/** Today where the café is, not where the server is. */
export function cafeToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

/** Where staff go to count the drawer. Null when the till isn't configured. */
export function tillCashUpUrl(): string | null {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  return base ? `${base}/cash-up` : null
}

export async function tillCashUp(date = cafeToday()): Promise<TillCashUp> {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  const token = (process.env.TILL_STOCK_TOKEN ?? process.env.TILL_READ_TOKEN)?.trim()
  if (!base || !token) return UNASKED

  try {
    const response = await fetch(
      `${base}/api/hub/report/cash-up?date=${encodeURIComponent(date)}`,
      {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
        // Short: this sits in front of clocking out, and a slow till must not
        // keep someone standing at the door.
        signal: AbortSignal.timeout(5_000),
      },
    )
    const body = (await response.json().catch(() => null)) as {
      cashed_up?: boolean
      closed_by?: string | null
      closed_at?: string | null
    } | null
    if (!response.ok || !body || typeof body.cashed_up !== 'boolean') return UNASKED
    return {
      asked: true,
      cashedUp: body.cashed_up,
      by: body.closed_by ?? null,
      at: body.closed_at ?? null,
    }
  } catch {
    return UNASKED
  }
}

/**
 * Tick the cash-up job off when the till says the drawer has been counted.
 *
 * Writes the same cleaning_log row a tap would, so everything that reads the
 * checklist — the staff list, the manager's compliance view, the closing
 * guard — needs to know nothing about the till. One row per task per day is a
 * unique index, so running this on every page load is harmless.
 *
 * Credited to whoever was signed on at the till if their name is one of ours,
 * because that is who actually counted it; otherwise to the person closing up.
 */
export async function syncCashUpTick(fallbackProfileId: string): Promise<TillCashUp> {
  const state = await tillCashUp()
  if (!state.asked || !state.cashedUp) return state

  const admin = createAdminClient()
  const { data: task } = await admin
    .from('cleaning_tasks')
    .select('id')
    .eq('link_href', CASH_UP_PATH)
    .eq('active', true)
    .maybeSingle()
  if (!task) return state

  const matched = state.by ? await profileNamed(state.by) : null

  await admin.from('cleaning_log').insert({
    task_id: task.id,
    user_id: matched ?? fallbackProfileId,
    completed_at: state.at ?? new Date().toISOString(),
    notes: state.by ? `Counted on the till by ${state.by}` : 'Counted on the till',
  })
  // A duplicate means it is already ticked off, which is the point.
  return state
}

/**
 * The profile behind a till name. The till signs people on by first name
 * ("Taylor") where the rota carries the whole one ("Taylor Cutting"), so the
 * first name is matched against the start of ours — but only when it picks out
 * exactly one person. Two Taylors and nobody is credited by guesswork.
 */
async function profileNamed(tillName: string): Promise<string | null> {
  const name = tillName.trim()
  if (!name) return null
  const admin = createAdminClient()
  // % and _ are wildcards in ilike; a name is a name, not a pattern.
  const escaped = name.replace(/([%_\\])/g, '\\$1')
  const { data } = await admin
    .from('profiles')
    .select('id')
    .ilike('name', `${escaped}%`)
    .limit(2)
  return data?.length === 1 ? data[0].id : null
}
