'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { extractInvoice, type ExtractedInvoice } from './extract'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

async function requireAnyAuth() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/**
 * Bulk-process supplier invoice files. For each uploaded file:
 *  1. Save to the supplier-invoices storage bucket.
 *  2. Send to Claude for structured extraction.
 *  3. Insert a draft expenses row referencing the file.
 *  4. Try to match a bank_transaction by exact amount + supplier text.
 */
export async function uploadAndExtractInvoices(formData: FormData) {
  // Anyone signed in can snap a receipt — Paul wanted the whole team
  // able to upload. Auto-match and director-loan posting are still
  // owner-only (handled in their own actions).
  const session = await requireAnyAuth()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) {
    const returnTo =
      session.role === 'owner' ? '/owner/invoices-upload' : '/staff/receipts'
    redirect(`${returnTo}?error=Pick+at+least+one+file`)
  }

  const admin = createAdminClient()
  const errors: string[] = []
  let duplicatesSkipped = 0

  // Pre-fetch already-reconciled receipts so we can dedupe against them
  // BEFORE inserting a new row — saves Paul having to clean up later.
  const { data: reconciledRowsRaw } = await admin
    .from('expenses')
    .select('id, vendor, amount, date, paid_in_cash, director_loan_id')
  const { data: matchedRowsRaw } = await admin
    .from('bank_transactions')
    .select('matched_expense_id')
    .not('matched_expense_id', 'is', null)
  const matchedSet = new Set(
    (matchedRowsRaw ?? []).map((r) => r.matched_expense_id),
  )
  const reconciledSignatures = (reconciledRowsRaw ?? [])
    .filter((r) =>
      isReconciledRow({
        paid_in_cash: r.paid_in_cash,
        director_loan_id: r.director_loan_id,
        matched: matchedSet.has(r.id),
      }),
    )
    .map((r) => signatureOf(r))

  // Process files in parallel so a batch of 15 doesn't take 15× a single
  // file's time. Each task does: read bytes → upload to storage → call
  // Claude → insert expense row. Failures land in the errors list and
  // still create a draft row so nothing is silently lost.
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const bytes = await file.arrayBuffer()
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await admin.storage
          .from('supplier-invoices')
          .upload(storagePath, bytes, { contentType: file.type })
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

        let extracted: ExtractedInvoice
        try {
          extracted = await extractInvoice(file.name, bytes)
        } catch (e) {
          errors.push(`${file.name}: ${(e as Error).message}`)
          extracted = {
            date: null,
            supplier: null,
            amount: null,
            amount_net: null,
            vat_amount: null,
            vat_rate: null,
            reference: null,
            notes: 'AI extraction failed — fill in manually.',
            confidence: 'low',
          }
        }

        // Skip if this looks like a duplicate of an already-reconciled
        // receipt. Drop the file from storage so we don't accumulate
        // garbage in the bucket.
        const sig = signatureOf({
          vendor: extracted.supplier,
          amount: extracted.amount,
          date: extracted.date ?? new Date().toISOString().slice(0, 10),
        })
        if (reconciledSignatures.some((rs) => isSameReceipt(rs, sig))) {
          await admin.storage
            .from('supplier-invoices')
            .remove([storagePath])
          return { ok: false as const, skipped: true as const }
        }

        const payeeId = extracted.supplier
          ? await findOrCreatePayee(extracted.supplier)
          : null

        const { error: insertErr } = await admin.from('expenses').insert({
          user_id: session.profileId,
          date: extracted.date ?? new Date().toISOString().slice(0, 10),
          category: 'other',
          payee_id: payeeId,
          vendor: extracted.supplier ?? 'Unknown supplier',
          amount: extracted.amount ?? 0,
          reference: extracted.reference,
          receipt_path: storagePath,
          vat_rate: extracted.vat_rate,
          notes: extracted.notes,
          ai_extracted: true,
          ai_extracted_at: new Date().toISOString(),
          ai_raw: extracted as unknown as Record<string, unknown>,
        })
        if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`)
        return { ok: true as const }
      } catch (e) {
        errors.push(`${file.name}: ${(e as Error).message}`)
        return { ok: false as const }
      }
    }),
  )

  const processed = results.filter((r) => r.ok).length
  duplicatesSkipped = results.filter(
    (r) => 'skipped' in r && r.skipped === true,
  ).length
  const failures = results.length - processed - duplicatesSkipped

  // Auto-match every unmatched expense after the batch lands — but only
  // when an owner is uploading. For staff snaps we skip it; Paul can
  // re-run match from the reconciliation page.
  if (session.role === 'owner') {
    await runAutoMatch()
  }

  revalidatePath('/owner/invoices-upload')
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/staff/receipts')
  const params = new URLSearchParams()
  params.set(
    'notice',
    `Uploaded ${processed} receipt${processed === 1 ? '' : 's'}${
      duplicatesSkipped > 0
        ? `, ${duplicatesSkipped} duplicate${duplicatesSkipped === 1 ? '' : 's'} skipped`
        : ''
    }${failures > 0 ? `, ${failures} failed` : ''}.`,
  )
  if (errors.length > 0) {
    params.set('errors', errors.slice(0, 5).join(' | '))
  }
  const returnTo =
    session.role === 'owner'
      ? `/owner/invoices-reconcile?${params.toString()}`
      : `/staff/receipts?${params.toString()}`
  redirect(returnTo)
}

async function findOrCreatePayee(name: string): Promise<string | null> {
  const admin = createAdminClient()
  const clean = name.trim()
  if (!clean) return null
  const { data: existing } = await admin
    .from('payees')
    .select('id')
    .ilike('name', clean)
    .maybeSingle()
  if (existing) return existing.id
  const { data: created } = await admin
    .from('payees')
    .insert({ name: clean, active: true })
    .select('id')
    .single()
  return created?.id ?? null
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type DupeSignature = {
  vendor_norm: string
  amount_cents: number
  date_bucket: string // ISO date the receipt falls on (we allow ±3 days when comparing)
}

function signatureOf(e: {
  vendor: string | null
  amount: number | string | null
  date: string
}): DupeSignature {
  return {
    vendor_norm: normalize(e.vendor ?? ''),
    amount_cents: Math.round(Number(e.amount ?? 0) * 100),
    date_bucket: e.date,
  }
}

function isSameReceipt(a: DupeSignature, b: DupeSignature): boolean {
  if (a.amount_cents !== b.amount_cents) return false
  if (a.amount_cents === 0) return false // nothing to dedupe against
  if (!a.vendor_norm || !b.vendor_norm) return false
  if (a.vendor_norm !== b.vendor_norm) return false
  // ±3 days
  const ms = Math.abs(
    new Date(a.date_bucket + 'T00:00:00Z').getTime() -
      new Date(b.date_bucket + 'T00:00:00Z').getTime(),
  )
  return ms <= 3 * 24 * 60 * 60 * 1000
}

function isReconciledRow(row: {
  paid_in_cash: boolean | null
  director_loan_id: string | null
  matched: boolean
}): boolean {
  return row.matched || row.paid_in_cash === true || row.director_loan_id !== null
}

function describeMatch(
  vendor: string | null,
  description: string,
): boolean {
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

/**
 * For every expense with no bank_transaction match yet, look across the
 * full bank_transactions table for: exact amount AND a supplier-text
 * resemblance to the description. Date is ignored per Paul's rule.
 */
export async function runAutoMatch(): Promise<{
  matched: number
  unmatched: number
}> {
  await requireOwner()
  const admin = createAdminClient()

  // Pull unmatched expenses and all unmatched bank_transactions.
  const { data: txns } = await admin
    .from('bank_transactions')
    .select('id, amount, description, matched_expense_id')
    .is('matched_expense_id', null)

  // We need the inverse: expenses not yet matched by any txn. Easier to
  // fetch the matched_expense_id list and exclude.
  const { data: alreadyMatchedRows } = await admin
    .from('bank_transactions')
    .select('matched_expense_id')
    .not('matched_expense_id', 'is', null)
  const alreadyMatched = new Set(
    (alreadyMatchedRows ?? []).map((r) => r.matched_expense_id),
  )

  const { data: expenses } = await admin
    .from('expenses')
    .select('id, vendor, amount, director_loan_id, paid_in_cash')
    .is('director_loan_id', null)
    .eq('paid_in_cash', false)

  const candidateExpenses = (expenses ?? []).filter(
    (e) => !alreadyMatched.has(e.id),
  )

  let matched = 0
  for (const e of candidateExpenses) {
    if (!e.amount) continue
    const expectedDebit = -Math.abs(Number(e.amount))
    const txn = (txns ?? []).find(
      (t) =>
        Number(t.amount) === expectedDebit &&
        describeMatch(e.vendor, t.description),
    )
    if (!txn) continue
    await admin
      .from('bank_transactions')
      .update({ matched_expense_id: e.id })
      .eq('id', txn.id)
    await admin
      .from('expenses')
      .update({ reconciled_at: new Date().toISOString() })
      .eq('id', e.id)
    matched += 1
  }
  const unmatched = candidateExpenses.length - matched
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/owner/bank')
  return { matched, unmatched }
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
  const admin = createAdminClient()
  const { data: e } = await admin
    .from('expenses')
    .select('id, date, amount, vendor, reference, cash_movement_id')
    .eq('id', expenseId)
    .maybeSingle()
  if (!e) return

  // Idempotent: don't double-deduct if already marked.
  if (e.cash_movement_id) {
    revalidatePath('/owner/invoices-reconcile')
    return
  }

  const { data: mv } = await admin
    .from('cash_movements')
    .insert({
      user_id: session.profileId,
      date: e.date,
      direction: 'out',
      amount: e.amount,
      reason: `Receipt — ${e.vendor ?? 'unknown supplier'}`,
      reference: e.reference,
    })
    .select('id')
    .single()

  if (mv) {
    await admin
      .from('expenses')
      .update({
        paid_in_cash: true,
        cash_movement_id: mv.id,
        reconciled_at: new Date().toISOString(),
      })
      .eq('id', expenseId)
  }
  revalidatePath('/owner/invoices-reconcile')
  revalidatePath('/manager/cash')
}

export async function markExpenseAsDirectorPaid(
  expenseId: string,
): Promise<void> {
  await requireOwner()
  const admin = createAdminClient()
  const { data: e } = await admin
    .from('expenses')
    .select('id, date, amount, vendor, reference')
    .eq('id', expenseId)
    .maybeSingle()
  if (!e) return

  const { data: dl } = await admin
    .from('director_loans')
    .insert({
      date: e.date,
      direction: 'in', // director put money in (paid an expense personally)
      amount: e.amount,
      description: `Paid supplier invoice — ${e.vendor ?? 'unknown'}`,
      reference: e.reference,
    })
    .select('id')
    .single()

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
