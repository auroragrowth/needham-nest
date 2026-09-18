'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { isReconciledRow, isSameReceipt, signatureOf } from './dedupe'
import { autoMatchExpenses } from './match'
import { markPaidInCash, unmarkPaidInCash } from './cash'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

/**
 * Match unmatched expenses to bank lines (see src/lib/invoices/match.ts).
 * This also runs by itself after every invoice is read and every bank import;
 * the button on Invoice reconciliation is for after a manual change.
 */
export async function runAutoMatch(): Promise<{
  matched: number
  unmatched: number
}> {
  await requireOwner()
  const result = await autoMatchExpenses()
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/bank')
  return result
}

/**
 * Mark a receipt as paid in cash from the till. Creates a corresponding
 * cash_movements 'out' entry so the till total is reduced automatically,
 * and links it back via expense.cash_movement_id for the audit trail.
 */
export async function markExpenseAsPaidInCash(
  expenseId: string,
): Promise<void> {
  const session = await requireOwner()
  await markPaidInCash(expenseId, session.profileId)
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/manager/cash')
}

/**
 * It wasn't paid in cash after all: give the till its money back and check the
 * invoice against the bank instead, straight away.
 */
export async function undoPaidInCash(expenseId: string): Promise<void> {
  const session = await requireOwner()
  if (await unmarkPaidInCash(expenseId, session.name)) {
    await autoMatchExpenses()
  }
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/bank')
  revalidatePath('/manager/cash')
}

export async function markExpenseAsDirectorPaid(
  expenseId: string,
): Promise<void> {
  const session = await requireOwner()
  const admin = createAdminClient()
  const { data: e } = await admin
    .from('expenses')
    .select('id, date, amount, vendor, reference, director_loan_id')
    .eq('id', expenseId)
    .maybeSingle()
  if (!e) return
  // Idempotent — don't double-post if the button gets tapped twice.
  if (e.director_loan_id) return

  const { data: dl, error: dlErr } = await admin
    .from('director_loans')
    .insert({
      // user_id FKs to profiles(id) and is NOT NULL — was the cause of
      // the silent failure on this button. Use the signed-in owner.
      user_id: session.profileId,
      date: e.date,
      direction: 'in', // director put money in (paid an expense personally)
      amount: e.amount,
      description: `Paid supplier invoice — ${e.vendor ?? 'unknown'}`,
      reference: e.reference,
    })
    .select('id')
    .single()

  if (dlErr) {
    redirect(
      `/owner/invoices-reconcile?errors=${encodeURIComponent('Director loan post failed: ' + dlErr.message)}`,
    )
  }

  if (dl) {
    await admin
      .from('expenses')
      .update({
        director_loan_id: dl.id,
        reconciled_at: new Date().toISOString(),
      })
      .eq('id', expenseId)
  }
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/director-loan')
}

/**
 * Sweep the expense ledger for unreconciled duplicates of receipts
 * already settled (matched, paid in cash, or director loan). Each
 * unreconciled dupe is removed via deleteExpense so storage stays
 * tidy and totals don't double-count.
 *
 * Returns the number of duplicates that were removed.
 */
export async function cleanupDuplicates(): Promise<number> {
  await requireOwner()
  const admin = createAdminClient()

  const { data: all } = await admin
    .from('expenses')
    .select('id, vendor, amount, date, paid_in_cash, director_loan_id')
  const { data: matchedRows } = await admin
    .from('bank_transactions')
    .select('matched_expense_id')
    .not('matched_expense_id', 'is', null)
  const matchedSet = new Set(
    (matchedRows ?? []).map((r) => r.matched_expense_id),
  )

  const reconciled = (all ?? []).filter((r) =>
    isReconciledRow({
      paid_in_cash: r.paid_in_cash,
      director_loan_id: r.director_loan_id,
      matched: matchedSet.has(r.id),
    }),
  )
  const unreconciled = (all ?? []).filter(
    (r) =>
      !isReconciledRow({
        paid_in_cash: r.paid_in_cash,
        director_loan_id: r.director_loan_id,
        matched: matchedSet.has(r.id),
      }),
  )

  const reconciledSigs = reconciled.map((r) => signatureOf(r))

  let deleted = 0
  for (const u of unreconciled) {
    const sig = signatureOf(u)
    if (reconciledSigs.some((rs) => isSameReceipt(rs, sig))) {
      await deleteExpense(u.id)
      deleted += 1
    }
  }

  revalidatePath('/owner/invoices-reconcile')
  return deleted
}

/**
 * Delete a receipt entirely — the expense row, the file in storage, and
 * any linked cash_movement (so the till's balance returns to what it
 * was before the receipt was logged). Director loan entries are left
 * intact so the lender side of the books isn't silently rewritten.
 */
export async function deleteExpense(expenseId: string): Promise<void> {
  await requireOwner()
  const admin = createAdminClient()

  const { data: e } = await admin
    .from('expenses')
    .select('id, receipt_path, cash_movement_id')
    .eq('id', expenseId)
    .maybeSingle()
  if (!e) return

  // Clear any matched bank transaction so the bank line is free again.
  await admin
    .from('bank_transactions')
    .update({ matched_expense_id: null, manual_match: false })
    .eq('matched_expense_id', expenseId)

  // Drop the file from storage (best-effort — don't block on errors).
  if (e.receipt_path) {
    await admin.storage.from('supplier-invoices').remove([e.receipt_path])
  }

  await admin.from('expenses').delete().eq('id', expenseId)

  // Roll back the till hit if this was a cash-paid receipt.
  if (e.cash_movement_id) {
    await admin.from('cash_movements').delete().eq('id', e.cash_movement_id)
  }

  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/receipts')
  revalidatePath('/manager/cash')
  revalidatePath('/owner/expenses')
}

/**
 * Merge two expenses into one — useful for multi-page receipts (Makro,
 * Booker, etc.) that uploaded as separate rows. The 'source' row's
 * receipt file(s) get appended to the 'target' as additional pages,
 * then the source row is deleted. Bank match on the source is cleared
 * so the bank line is freed (the target's match, if any, stays).
 */
export async function mergeIntoExpense(
  sourceId: string,
  targetId: string,
): Promise<void> {
  await requireOwner()
  if (sourceId === targetId) return
  const admin = createAdminClient()

  const [{ data: src }, { data: tgt }] = await Promise.all([
    admin
      .from('expenses')
      .select('id, receipt_path, additional_receipt_paths, cash_movement_id')
      .eq('id', sourceId)
      .maybeSingle(),
    admin
      .from('expenses')
      .select('id, additional_receipt_paths')
      .eq('id', targetId)
      .maybeSingle(),
  ])
  if (!src || !tgt) return

  // Build the new attachment list on the target.
  const merged = [
    ...(tgt.additional_receipt_paths ?? []),
    ...(src.receipt_path ? [src.receipt_path] : []),
    ...(src.additional_receipt_paths ?? []),
  ]

  await admin
    .from('expenses')
    .update({ additional_receipt_paths: merged })
    .eq('id', targetId)

  // Free any bank match on the source so the bank line is reusable.
  await admin
    .from('bank_transactions')
    .update({ matched_expense_id: null, manual_match: false })
    .eq('matched_expense_id', sourceId)

  // Roll back source's till hit (it was a separate row pretending to be
  // a separate cash withdrawal — the target keeps its own movement).
  if (src.cash_movement_id) {
    await admin
      .from('cash_movements')
      .delete()
      .eq('id', src.cash_movement_id)
  }

  // Delete the source row but DON'T remove the files — they're now
  // attached to the target.
  await admin.from('expenses').delete().eq('id', sourceId)

  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/expenses')
}

/**
 * Take one bank line off an expense: "Not this one" on an expense matched to
 * more than one bank payment (an old matching bug gave two Premier receipts
 * two lines each). The expense keeps any other line; with none left it is
 * unreconciled again. Matching then runs, so the freed line can find the
 * purchase it really paid for.
 */
export async function unmatchBankLine(bankTransactionId: string): Promise<void> {
  await requireOwner()
  const admin = createAdminClient()
  const { data: txn } = await admin
    .from('bank_transactions')
    .select('id, matched_expense_id')
    .eq('id', bankTransactionId)
    .maybeSingle()
  const expenseId = txn?.matched_expense_id
  if (expenseId) {
    await admin
      .from('bank_transactions')
      .update({ matched_expense_id: null, manual_match: false })
      .eq('id', bankTransactionId)
    const { data: rest } = await admin
      .from('bank_transactions')
      .select('id')
      .eq('matched_expense_id', expenseId)
      .limit(1)
    if ((rest ?? []).length === 0) {
      await admin.from('expenses').update({ reconciled_at: null }).eq('id', expenseId)
    }
    await autoMatchExpenses()
  }
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/bank')
}

export async function manuallyMatchExpense(
  expenseId: string,
  bankTransactionId: string,
): Promise<void> {
  await requireOwner()
  const admin = createAdminClient()
  await admin
    .from('bank_transactions')
    .update({ matched_expense_id: expenseId, manual_match: true })
    .eq('id', bankTransactionId)
  await admin
    .from('expenses')
    .update({ reconciled_at: new Date().toISOString() })
    .eq('id', expenseId)
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/bank')
}
