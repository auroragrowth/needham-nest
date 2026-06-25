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
  let processed = 0
  let failures = 0
  const errors: string[] = []

  for (const file of files) {
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
        // Still create a draft row so Paul can fill it in by hand.
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

      const payeeId = extracted.supplier
        ? await findOrCreatePayee(extracted.supplier)
        : null

      const { error: insertErr } = await admin.from('expenses').insert({
        // expenses.user_id FKs to profiles(id), NOT NULL — use the session
        // profile, not the auth.users id which is null for PIN-only logins.
        user_id: session.profileId,
        date: extracted.date ?? new Date().toISOString().slice(0, 10),
        // Default to 'other' — Paul (or the team) re-categorises from the
        // expense edit screen. Valid enum: food_purchases, drink_purchases,
        // cleaning, rent_utilities, repairs_maintenance, insurance, staff,
        // equipment, marketing, other.
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
      processed += 1
    } catch (e) {
      failures += 1
      errors.push(`${file.name}: ${(e as Error).message}`)
    }
  }

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
      failures > 0 ? `, ${failures} failed` : ''
    }.`,
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
    .select('id, vendor, amount, director_loan_id')
    .is('director_loan_id', null)

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
