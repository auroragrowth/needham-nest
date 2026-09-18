import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Receipts to find: bank payments out that no receipt or invoice accounts
 * for, grouped by who was paid and where, so Paul can fetch the paperwork
 * (Amazon order history, a Tesco receipt) and upload it against the payment.
 *
 * Left out, because they will never have a receipt:
 * - anything matched to an expense or to takings
 * - payments marked "No receipt needed" (bank_transactions.no_receipt_reason)
 * - payees in bank_payee_rules ("Never needs a receipt")
 * - pay: a reference like "W15", "Wk 13", "Week 20", "Wages", "Pay advance" or a
 *   date range ("1st-7th June"), or Monzo's Wages category. Judged on the
 *   reference, not the person: staff are also paid back for shopping by
 *   transfer (May: "Shopping", "Tesco's receipt"), and those need receipts
 * - Monzo's Transfers category, and cash machine withdrawals
 */

export type MissingPayment = {
  id: string
  date: string
  amount: number
  location: string | null
  detail: string
}

export type MissingGroup = {
  payee: string
  total: number
  payments: MissingPayment[]
  /** Distinct places, for the group header ("Copdock Interchange, Stowmarket"). */
  locations: string[]
}

export type ReceiptsToFind = {
  groups: MissingGroup[]
  count: number
  total: number
  /** YYYY-MM months that have missing receipts, newest first, for the filter. */
  months: string[]
}

type Raw = Record<string, string | undefined> | null

const NEVER_CATEGORIES = new Set(['transfers', 'wages'])

/** References the café uses when paying wages. */
const PAY_REFERENCE = [
  /^\s*(w|wk|week)\s*\d+/i, // W15, Wk 13, Week 20, Week21, Wk 22 est
  /\bwages?\b/i, // Wages, Wage advanced
  /\bpay\s*advance/i, // Pay Advance 1of4
  /^\s*\d{1,2}(st|nd|rd|th)?\s*-\s*\d{1,2}(st|nd|rd|th)\b/i, // 1st-7th June, 15th -21st
]

export function isPayReference(reference: string): boolean {
  return PAY_REFERENCE.some((re) => re.test(reference))
}

export function payeeKey(name: string): string {
  return name.trim().toLowerCase()
}

/** Monzo's own name for who was paid; older rows only have the description. */
function payeeOf(raw: Raw, description: string): string {
  const name = raw?.name?.trim()
  if (name) return name
  return description.split(' · ')[0]?.trim() || description.trim() || 'Unknown'
}

export async function loadReceiptsToFind(month: string | null): Promise<ReceiptsToFind> {
  const admin = createAdminClient()
  const [{ data: lines }, { data: rules }] = await Promise.all([
    admin
      .from('bank_transactions')
      .select('id, date, description, amount, raw_row')
      .lt('amount', 0)
      .is('matched_expense_id', null)
      .is('matched_takings_id', null)
      .is('no_receipt_reason', null)
      .order('date', { ascending: false })
      .limit(5000),
    admin.from('bank_payee_rules').select('payee'),
  ])
  const never = new Set((rules ?? []).map((r) => r.payee))

  const monthSet = new Set<string>()
  const byPayee = new Map<string, MissingGroup>()
  for (const line of lines ?? []) {
    const raw = line.raw_row as Raw
    const payee = payeeOf(raw, line.description)
    const category = raw?.category?.trim().toLowerCase() ?? ''
    const reference = raw?.['notes and #tags']?.trim() || raw?.description?.trim() || ''
    if (never.has(payeeKey(payee))) continue
    if (NEVER_CATEGORIES.has(category)) continue
    if (payeeKey(payee) === 'atm') continue
    if (raw?.type === 'Faster payment' && isPayReference(reference)) continue

    const m = line.date.slice(0, 7)
    monthSet.add(m)
    if (month && m !== month) continue

    const amount = -Number(line.amount)
    const location = raw?.address?.trim() || null
    const detail = reference
    const key = payeeKey(payee)
    const group = byPayee.get(key) ?? { payee, total: 0, payments: [], locations: [] }
    group.total += amount
    group.payments.push({ id: line.id, date: line.date, amount, location, detail })
    if (location && !group.locations.includes(location)) group.locations.push(location)
    byPayee.set(key, group)
  }

  const groups = [...byPayee.values()].sort((a, b) => b.total - a.total)
  for (const g of groups) {
    // Within a payee, by place then newest first, so a store's visits sit together.
    g.payments.sort((a, b) =>
      (a.location ?? '') === (b.location ?? '')
        ? b.date.localeCompare(a.date)
        : (a.location ?? '').localeCompare(b.location ?? ''),
    )
  }
  return {
    groups,
    count: groups.reduce((n, g) => n + g.payments.length, 0),
    total: groups.reduce((n, g) => n + g.total, 0),
    months: [...monthSet].sort().reverse(),
  }
}
