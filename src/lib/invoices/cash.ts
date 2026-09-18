import { createAdminClient } from '@/lib/supabase/admin'

/**
 * An invoice paid with cash from the till: the expense is settled (it will
 * never appear on the bank statement) and a cash_movements 'out' entry takes
 * the amount off the till's balance, linked back through
 * expense.cash_movement_id for the audit trail.
 *
 * Idempotent: an expense already paid in cash is left alone, and so is one
 * the bank has already matched. No auth check here: callers are server code
 * that has already checked (the owner's button, or the "Paid cash from the
 * till" tick on /invoices).
 */
export async function markPaidInCash(expenseId: string, byProfileId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [{ data: e }, { data: bank }] = await Promise.all([
    admin
      .from('expenses')
      .select('id, date, amount, vendor, reference, cash_movement_id')
      .eq('id', expenseId)
      .maybeSingle(),
    admin.from('bank_transactions').select('id').eq('matched_expense_id', expenseId).limit(1),
  ])
  if (!e || e.cash_movement_id || (bank ?? []).length > 0) return false

  const { data: mv } = await admin
    .from('cash_movements')
    .insert({
      user_id: byProfileId,
      date: e.date,
      direction: 'out',
      amount: e.amount,
      reason: `Receipt — ${e.vendor ?? 'unknown supplier'}`,
      reference: e.reference,
    })
    .select('id')
    .single()
  if (!mv) return false

  await admin
    .from('expenses')
    .update({ paid_in_cash: true, cash_movement_id: mv.id, reconciled_at: new Date().toISOString() })
    .eq('id', expenseId)
  return true
}

/**
 * Undo `markPaidInCash`: it wasn't cash after all (6813 was marked cash but
 * went by bank transfer). Removes the till's cash-out entry, so the till's
 * balance gets the amount back, and leaves the expense unmatched for the bank,
 * with a note of what changed and who asked.
 */
export async function unmarkPaidInCash(expenseId: string, byName: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: e } = await admin
    .from('expenses')
    .select('id, amount, notes, paid_in_cash, cash_movement_id')
    .eq('id', expenseId)
    .maybeSingle()
  if (!e || !e.paid_in_cash) return false

  if (e.cash_movement_id) {
    await admin.from('cash_movements').delete().eq('id', e.cash_movement_id)
  }
  const when = new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const audit = `[${when}, ${byName}: was marked paid in cash (£${Number(e.amount).toFixed(2)} out of the till) — not cash after all. Cash entry removed, left for the bank.]`
  await admin
    .from('expenses')
    .update({
      paid_in_cash: false,
      cash_movement_id: null,
      reconciled_at: null,
      notes: [audit, e.notes].filter(Boolean).join(' '),
    })
    .eq('id', expenseId)
  return true
}
