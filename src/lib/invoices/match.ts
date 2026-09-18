import { createAdminClient } from '@/lib/supabase/admin'
import { normalize } from './dedupe'

/**
 * Check expenses off against the bank: for every expense with no bank line
 * yet (and not paid in cash or by the director), find an unmatched bank debit
 * of exactly that amount whose description resembles the supplier. Date is
 * ignored per Paul's rule.
 *
 * Runs by itself whenever an invoice is read into the books
 * (src/lib/invoice-capture/read.ts) and whenever a bank statement is imported
 * (src/lib/bank/actions.ts), so whichever arrives second does the matching.
 * No auth check here: callers are server code that has already checked.
 */
export async function autoMatchExpenses(): Promise<{ matched: number; unmatched: number }> {
  const admin = createAdminClient()

  const [{ data: txns }, { data: alreadyMatchedRows }, { data: expenses }] = await Promise.all([
    admin
      .from('bank_transactions')
      .select('id, amount, description, matched_expense_id')
      .is('matched_expense_id', null),
    admin.from('bank_transactions').select('matched_expense_id').not('matched_expense_id', 'is', null),
    admin
      .from('expenses')
      .select('id, vendor, amount, director_loan_id, paid_in_cash')
      .is('director_loan_id', null)
      .eq('paid_in_cash', false),
  ])
  const alreadyMatched = new Set((alreadyMatchedRows ?? []).map((r) => r.matched_expense_id))
  const candidates = (expenses ?? []).filter((e) => !alreadyMatched.has(e.id))
  // Each bank line pays for one expense: take it out once it's used.
  const free = [...(txns ?? [])]

  let matched = 0
  for (const e of candidates) {
    if (!e.amount) continue
    const expectedDebit = -Math.abs(Number(e.amount))
    const i = free.findIndex(
      (t) => Number(t.amount) === expectedDebit && describeMatch(e.vendor, t.description),
    )
    if (i === -1) continue
    const [txn] = free.splice(i, 1)
    await admin.from('bank_transactions').update({ matched_expense_id: e.id }).eq('id', txn.id)
    await admin.from('expenses').update({ reconciled_at: new Date().toISOString() }).eq('id', e.id)
    matched += 1
  }
  return { matched, unmatched: candidates.length - matched }
}

function describeMatch(vendor: string | null, description: string): boolean {
  if (!vendor) return false
  const v = normalize(vendor)
  const d = normalize(description)
  if (!v || !d) return false
  if (d.includes(v)) return true
  // Compare first word of vendor against description as a fallback —
  // suppliers often appear truncated on bank statements.
  const head = v.split(' ')[0]
  return head.length >= 3 && d.includes(head)
}
