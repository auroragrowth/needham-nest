import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Taking what the till sold off the shelves.
 *
 * The café app holds the stock; the till knows what each sale used (a latte is a
 * dose of coffee and 350ml of milk). The till's usage feed says what was used
 * between two times, in its own ids and units; this turns that into the café's
 * units and takes it off, café zone first, then kitchen, never below zero
 * (apply_till_usage in supabase/till_usage_2026-09-18.sql).
 *
 * Each item only loses what sold after it was last counted, because a stock
 * take already reflects everything sold before it. So the first run needs no
 * starting point: every counted item picks up from its own count.
 *
 * Needs TILL_URL and TILL_STOCK_TOKEN (the till's CAFE_STOCK_TOKEN, which can
 * read the usage feed and nothing with money in it).
 */

type UsageRow = { stock_id: string; name: string; kind: string; unit: string; used: number }

export type TillUsageResult = {
  since: string | null
  until: string
  skipped: boolean
  applied: { name: string; used: number }[]
  shortfalls: unknown[]
  /** Linked items with nothing to count from yet: never counted, and no earlier run. */
  notCounted: string[]
  errors: string[]
}

/**
 * How far behind now each run stops. An order's time is set as it starts to
 * save, so one still saving at the moment of reading could be missed forever
 * by a window that has already moved past it. Two minutes is far longer than a
 * sale takes to save.
 */
const SETTLE_MS = 2 * 60 * 1000

async function usage(since: string, until: string): Promise<Map<string, number>> {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  if (!base) throw new Error('TILL_URL is not set.')
  const token = (process.env.TILL_STOCK_TOKEN ?? process.env.TILL_READ_TOKEN)?.trim()
  if (!token) throw new Error('TILL_STOCK_TOKEN is not set, so the till usage feed cannot be read.')

  const url = `${base}/api/hub/report/usage?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await response.json().catch(() => null)) as { rows?: UsageRow[]; error?: string } | null
  if (!response.ok || !body?.rows) throw new Error(`till usage: ${body?.error ?? response.status}`)
  return new Map(body.rows.map((r) => [r.stock_id, Number(r.used)]))
}

/**
 * What each item used, in the café's own units: the till counts in its units
 * (doses, grams, each) and till_servings_per_unit says how many make one of
 * ours (29.41 doses a bag of coffee). Pure, so it can be checked on its own.
 */
export function toCafeUnits(used: number, servingsPerUnit: number | null): number {
  const per = Number(servingsPerUnit) || 1
  return Math.round((used / per) * 10_000) / 10_000
}

export async function applyTillUsage(now = new Date()): Promise<TillUsageResult> {
  const admin = createAdminClient()
  const until = new Date(now.getTime() - SETTLE_MS).toISOString()
  const result: TillUsageResult = { since: null, until, skipped: false, applied: [], shortfalls: [], notCounted: [], errors: [] }

  const [{ data: cursor, error: cursorError }, { data: items, error: itemsError }] = await Promise.all([
    admin.from('till_usage_cursor').select('until').eq('id', 1).maybeSingle(),
    admin
      .from('stock_items')
      .select('id, name, till_item_id, till_servings_per_unit')
      .eq('active', true)
      .not('till_item_id', 'is', null),
  ])
  if (cursorError) throw new Error(cursorError.message)
  if (itemsError) throw new Error(itemsError.message)
  const last = (cursor?.until as string | undefined) ?? null
  result.since = last
  if (!items?.length) return result

  // When each item was last counted: a stock take already includes every sale
  // before it, so only what sold after it comes off.
  const { data: counts, error: countsError } = await admin
    .from('stock_location_moves')
    .select('stock_item_id, moved_at')
    .eq('kind', 'adjust')
    .in('stock_item_id', items.map((i) => i.id))
    .order('moved_at', { ascending: false })
  if (countsError) throw new Error(countsError.message)
  const lastCounted = new Map<string, string>()
  for (const move of counts ?? []) {
    if (!lastCounted.has(move.stock_item_id)) lastCounted.set(move.stock_item_id, move.moved_at)
  }

  // Each item reads from the later of the last run and its own count. Items
  // counted at the same moment (one stock take save) share one read.
  const bySince = new Map<string, typeof items>()
  for (const item of items) {
    const counted = lastCounted.get(item.id) ?? null
    const from = [last, counted].filter((t): t is string => !!t).sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    if (!from) {
      result.notCounted.push(item.name)
      continue
    }
    if (Date.parse(from) >= Date.parse(until)) continue
    const key = new Date(from).toISOString()
    bySince.set(key, [...(bySince.get(key) ?? []), item])
  }

  const payload: { stock_item_id: string; quantity: number }[] = []
  for (const [from, group] of bySince) {
    const used = await usage(from, until)
    for (const item of group) {
      const quantity = toCafeUnits(used.get(item.till_item_id as string) ?? 0, item.till_servings_per_unit)
      if (quantity !== 0) payload.push({ stock_item_id: item.id, quantity })
    }
  }

  // All of it in one transaction, and only if nobody has moved the cursor since
  // it was read above — so an overlapping or retried run can't double up.
  const { data, error } = await admin.rpc('apply_till_usage', {
    p_expected: last,
    p_until: until,
    p_items: payload,
  })
  if (error) throw new Error(error.message)
  const outcome = data as { skipped: boolean; applied?: { name: string; used: number }[]; shortfalls?: unknown[] }
  result.skipped = outcome.skipped
  result.applied = outcome.applied ?? []
  result.shortfalls = outcome.shortfalls ?? []
  return result
}
