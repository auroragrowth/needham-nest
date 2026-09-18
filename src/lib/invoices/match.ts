import { createAdminClient } from '@/lib/supabase/admin'
import { normalize, normalizeReference } from './dedupe'

/**
 * Check expenses off against the bank. For every expense with no bank line
 * yet (and not paid in cash or by the director), look for an unmatched bank
 * debit that:
 *
 * 1. is exactly the amount, and whose description resembles the supplier; or
 * 2. carries the invoice number in its reference, resembles the supplier, and
 *    is within 10% of the amount. Suppliers paid by transfer (the Butchers)
 *    get their invoice number as the reference, and the amount paid is not
 *    always the invoice total (6815: invoiced £210.89, paid £210.00). The
 *    difference goes in the expense's notes for Paul to look at.
 *
 * Date is ignored per Paul's rule. Exact matches are taken first, so a
 * near-miss never takes a bank line an exact match needed.
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
      .select('id, vendor, amount, reference, director_loan_id, paid_in_cash')
      .is('director_loan_id', null)
      .eq('paid_in_cash', false),
  ])
  const alreadyMatched = new Set((alreadyMatchedRows ?? []).map((r) => r.matched_expense_id))
  const candidates = (expenses ?? []).filter((e) => !alreadyMatched.has(e.id))
  // Each bank line pays for one expense: take it out once it's used.
  const free = [...(txns ?? [])]

  let matched = 0
  const settle = async (expenseId: string, txnId: string, note?: string) => {
    // Runs can overlap (an upload's read and a button press). Claim the bank
    // line only while it's still free and skip the expense if another run got
    // there first, so a line is never given twice and a note never doubled.
    const { data: claimed } = await admin
      .from('bank_transactions')
      .update({ matched_expense_id: expenseId })
      .eq('id', txnId)
      .is('matched_expense_id', null)
      .select('id')
    if ((claimed ?? []).length === 0) return
    const { data: twice } = await admin
      .from('bank_transactions')
      .select('id')
      .eq('matched_expense_id', expenseId)
    if ((twice ?? []).length > 1) {
      // Another run matched this expense to a different line meanwhile: give ours back.
      await admin.from('bank_transactions').update({ matched_expense_id: null }).eq('id', txnId)
      return
    }
    const update: Record<string, unknown> = { reconciled_at: new Date().toISOString() }
    if (note) {
      const { data } = await admin.from('expenses').select('notes').eq('id', expenseId).single()
      update.notes = [note, data?.notes].filter(Boolean).join(' ')
    }
    await admin.from('expenses').update(update).eq('id', expenseId)
    matched += 1
  }

  // 1. Exact amount and the supplier's name.
  const left: typeof candidates = []
  for (const e of candidates) {
    if (!e.amount) continue
    const expectedDebit = -Math.abs(Number(e.amount))
    const i = free.findIndex(
      (t) => Number(t.amount) === expectedDebit && describeMatch(e.vendor, t.description),
    )
    if (i === -1) {
      left.push(e)
      continue
    }
    const [txn] = free.splice(i, 1)
    await settle(e.id, txn.id)
  }

  // 2. The invoice number on the bank line, the supplier's name, and close on amount.
  for (const e of left) {
    const ref = normalizeReference(e.reference)
    if (!ref) continue
    const invoiced = Math.abs(Number(e.amount))
    const i = free.findIndex((t) => {
      const paid = -Number(t.amount)
      return (
        paid > 0 &&
        Math.abs(paid - invoiced) <= invoiced * 0.1 &&
        referenceTokens(t.description).has(ref) &&
        describeMatch(e.vendor, t.description)
      )
    })
    if (i === -1) continue
    const [txn] = free.splice(i, 1)
    const paid = -Number(txn.amount)
    await settle(
      e.id,
      txn.id,
      `⚠ Bank paid £${paid.toFixed(2)} against invoice total £${invoiced.toFixed(2)} (matched on invoice number) — check the difference.`,
    )
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

/** Every word in a bank description, read as an invoice number would be. */
function referenceTokens(description: string): Set<string> {
  return new Set(
    description
      .split(/[^A-Za-z0-9]+/)
      .map((w) => normalizeReference(w))
      .filter((w): w is string => w !== null),
  )
}

/**
 * Pair an expense with the bank payment it was uploaded for (Receipts to find
 * → "Upload receipt"). The owner chose the payment, so the supplier's name
 * doesn't have to match — an Amazon receipt names the marketplace seller, the
 * bank says "Amazon". A difference in amount is noted on the expense.
 *
 * Leaves things alone if the expense already has a bank line (a repeat photo
 * of something matched before) or the payment has been taken meanwhile.
 */
export async function linkBankLine(
  bankTransactionId: string,
  expenseId: string,
): Promise<'linked' | 'already' | 'taken'> {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('bank_transactions')
    .select('id')
    .eq('matched_expense_id', expenseId)
    .limit(1)
  if ((existing ?? []).length > 0) return 'already'

  const { data: claimed } = await admin
    .from('bank_transactions')
    .update({ matched_expense_id: expenseId, manual_match: true })
    .eq('id', bankTransactionId)
    .is('matched_expense_id', null)
    .select('amount')
  const line = (claimed ?? [])[0]
  if (!line) return 'taken'

  const { data: e } = await admin.from('expenses').select('amount, notes').eq('id', expenseId).single()
  const paid = -Number(line.amount)
  const invoiced = Math.abs(Number(e?.amount ?? 0))
  const update: Record<string, unknown> = { reconciled_at: new Date().toISOString() }
  if (Math.abs(paid - invoiced) >= 0.005) {
    update.notes = [
      `⚠ Uploaded for a bank payment of £${paid.toFixed(2)}; the receipt reads £${invoiced.toFixed(2)} — check the difference.`,
      e?.notes,
    ]
      .filter(Boolean)
      .join(' ')
  }
  await admin.from('expenses').update(update).eq('id', expenseId)
  return 'linked'
}
