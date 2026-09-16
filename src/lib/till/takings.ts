import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Till takings, fed into this app's `takings` table so the P&L and tax pot use
 * real sales.
 *
 * The till (needham-nest-till.vercel.app) is the record of what was sold. Once a
 * day this reads its card and cash totals per day through the till's read-only
 * report endpoint and writes one takings row per day per payment type, marked
 * with a `till:` reference. Running it again updates those rows rather than
 * adding more, so it is safe to re-run for any range.
 *
 * Needs TILL_URL and TILL_READ_TOKEN (the till's HUB_READ_TOKEN).
 */

const SOURCES: Record<string, 'card' | 'cash'> = { card: 'card', cash: 'cash' }

export type TillTakingsResult = {
  from: string
  to: string
  days: number
  created: number
  updated: number
  unchanged: number
  errors: string[]
}

type PaymentRow = { payment_type: string; receipts: number; net: number }

export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export function tillReference(day: string, source: string): string {
  return `till:${day}:${source}`
}

async function tillPayments(day: string): Promise<PaymentRow[]> {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  const token = process.env.TILL_READ_TOKEN?.trim()
  if (!base || !token) throw new Error('TILL_URL and TILL_READ_TOKEN must be set to import till takings.')

  const url = `${base}/api/hub/report/payment?preset=custom&from=${day}&to=${day}`
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await response.json().catch(() => null)) as { rows?: PaymentRow[]; error?: string } | null
  if (!response.ok || !body) throw new Error(`till ${day}: ${body?.error ?? response.status}`)
  return body.rows ?? []
}

export async function importTillTakings(from: string, to: string): Promise<TillTakingsResult> {
  const admin = createAdminClient()
  const result: TillTakingsResult = { from, to, days: 0, created: 0, updated: 0, unchanged: 0, errors: [] }

  // Takings rows need a person. These are recorded by the system on the owner's behalf.
  const { data: owner } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'owner')
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!owner) {
    result.errors.push('No active owner profile to record till takings against.')
    return result
  }

  for (const day of eachDay(from, to)) {
    result.days += 1
    let rows: PaymentRow[]
    try {
      rows = await tillPayments(day)
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e))
      continue
    }

    // Till money is integer pence; this app stores pounds.
    const amounts: Record<'card' | 'cash', number> = { card: 0, cash: 0 }
    for (const row of rows) {
      const source = SOURCES[row.payment_type]
      if (source) amounts[source] += Number(row.net) / 100
    }

    for (const source of ['card', 'cash'] as const) {
      const amount = Math.round(amounts[source] * 100) / 100
      const reference = tillReference(day, source)
      const { data: existing } = await admin
        .from('takings')
        .select('id, amount')
        .eq('reference', reference)
        .maybeSingle()

      if (existing) {
        if (Number(existing.amount) === amount) {
          result.unchanged += 1
          continue
        }
        const { error } = await admin.from('takings').update({ amount }).eq('id', existing.id)
        if (error) result.errors.push(`${reference}: ${error.message}`)
        else result.updated += 1
      } else if (amount > 0) {
        const { error } = await admin.from('takings').insert({
          user_id: owner.id,
          date: day,
          source,
          amount,
          description: `Till ${source} takings`,
          reference,
        })
        if (error) result.errors.push(`${reference}: ${error.message}`)
        else result.created += 1
      }
    }
  }
  return result
}
