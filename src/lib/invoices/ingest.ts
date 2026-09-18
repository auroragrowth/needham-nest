import { createAdminClient } from '@/lib/supabase/admin'
import { extractInvoice, type ExtractedInvoice } from './extract'
import {
  decideUpload,
  findSameInvoice,
  isReconciledRow,
  isSameReceipt,
  signatureOf,
  type InvoiceRow,
} from './dedupe'

/**
 * One invoice or receipt, one file: read it and put it in the expenses ledger,
 * ready for bank reconciliation. This is the single way paperwork enters the
 * books — /invoices calls it for every file as it arrives, and the catch-up
 * (src/lib/invoice-capture/read.ts) for anything that missed that.
 *
 * The rules are the ones the old bulk upload had, one file at a time:
 * - the same invoice number and total as a row already in → duplicate, dropped
 * - the same invoice number without a total → another page, attached
 * - the row had no total and this page has it → filled in, attached
 * - same number, different total → its own row, flagged
 * - no invoice number: same vendor and total within 3 days of a reconciled
 *   receipt → duplicate
 *
 * /invoices uploads three at a time, so pages of one invoice can be read side
 * by side and both land as new rows. `settle` then folds the later one into
 * the earlier; see there.
 *
 * Throws when the file can't be read at all (Claude or HEIC conversion
 * failed). Nothing is stored in that case, so the caller can try again later.
 */

export type IngestResult = {
  kind: 'new' | 'page' | 'duplicate'
  expenseId: string | null
  vendor: string | null
  amount: number | null
  /** Set when a person needs to look: no total read, or a clashing total. */
  warning: string | null
  extracted: ExtractedInvoice
}

const BUCKET = 'supplier-invoices'
// Pages of one invoice read in parallel land within seconds of each other.
const SETTLE_WINDOW_MS = 15 * 60 * 1000

export async function ingestInvoice(input: {
  bytes: ArrayBuffer
  fileName: string
  contentType: string
  /** The uploader's profile id, for expenses.user_id. */
  profileId: string
  /** The supplier picked at the back door, used when the read can't name one. */
  supplierHint?: string | null
}): Promise<IngestResult> {
  const extracted = await extractInvoice(input.fileName, input.bytes)
  if (!extracted.supplier && input.supplierHint) extracted.supplier = input.supplierHint

  const admin = createAdminClient()
  const ext = input.fileName.split('.').pop()?.toLowerCase() || 'bin'
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, input.bytes, { contentType: input.contentType || undefined })
  if (uploadErr) throw new Error(`Could not store the file: ${uploadErr.message}`)

  const drop = async () => {
    await admin.storage.from(BUCKET).remove([storagePath])
  }
  const result = (
    kind: IngestResult['kind'],
    row: { id: string | null; vendor: string | null; amount: number | null },
    warning: string | null = null,
  ): IngestResult => ({
    kind,
    expenseId: row.id,
    vendor: row.vendor,
    amount: row.amount,
    warning,
    extracted,
  })

  const [{ data: expenseRows }, { data: matchedRows }] = await Promise.all([
    admin
      .from('expenses')
      .select('id, vendor, amount, date, reference, additional_receipt_paths, paid_in_cash, director_loan_id'),
    admin.from('bank_transactions').select('matched_expense_id').not('matched_expense_id', 'is', null),
  ])
  const rows = expenseRows ?? []
  const invoices: InvoiceRow[] = rows.filter((r) => r.reference)
  const match = findSameInvoice(extracted, invoices)
  const decision = decideUpload(extracted, match)

  if (decision.kind === 'duplicate' && match) {
    await drop()
    return result('duplicate', { id: match.id, vendor: match.vendor, amount: num(match.amount) })
  }

  if (match && (decision.kind === 'attach_page' || decision.kind === 'fill_in')) {
    await attach(match.id, storagePath, decision.kind === 'fill_in' ? extracted : null)
    return result('page', {
      id: match.id,
      vendor: match.vendor,
      amount: decision.kind === 'fill_in' ? extracted.amount : num(match.amount),
    })
  }

  if (!match) {
    const matched = new Set((matchedRows ?? []).map((r) => r.matched_expense_id))
    const sig = signatureOf({
      vendor: extracted.supplier,
      amount: extracted.amount,
      date: extracted.date ?? today(),
    })
    const already = rows.find(
      (r) =>
        isReconciledRow({
          paid_in_cash: r.paid_in_cash,
          director_loan_id: r.director_loan_id,
          matched: matched.has(r.id),
        }) && isSameReceipt(signatureOf(r), sig),
    )
    if (already) {
      await drop()
      return result('duplicate', { id: already.id, vendor: already.vendor, amount: num(already.amount) })
    }
  }

  const warning = decision.kind === 'insert' ? decision.warning : null
  const vendor = extracted.supplier ?? 'Unknown supplier'
  const { data: row, error: insertErr } = await admin
    .from('expenses')
    .insert({
      user_id: input.profileId,
      date: extracted.date ?? today(),
      category: 'other',
      payee_id: extracted.supplier ? await findOrCreatePayee(extracted.supplier) : null,
      vendor,
      amount: extracted.amount ?? 0,
      reference: extracted.reference,
      receipt_path: storagePath,
      vat_rate: extracted.vat_rate,
      notes: warning ? [warning, extracted.notes].filter(Boolean).join(' ') : extracted.notes,
      ai_extracted: true,
      ai_extracted_at: new Date().toISOString(),
      ai_raw: extracted as unknown as Record<string, unknown>,
    })
    .select('id, created_at')
    .single()
  if (insertErr || !row) {
    await drop()
    throw new Error(`Could not add the expense: ${insertErr?.message ?? 'no row'}`)
  }

  const settled = await settle(row.id, row.created_at, storagePath, extracted)
  if (settled) return settled
  return result('new', { id: row.id, vendor, amount: extracted.amount }, warning)
}

/**
 * Two pages of one invoice read side by side each see no row for it yet, so
 * both insert. Afterwards, each looks for rows of the same invoice that landed
 * in the last few minutes; the earliest (by created_at, then id) keeps the
 * invoice and any later one folds itself in, by the same rules as above. Both
 * sides agree on which row is earliest, so exactly one survives.
 */
async function settle(
  selfId: string,
  selfCreatedAt: string,
  storagePath: string,
  extracted: ExtractedInvoice,
): Promise<IngestResult | null> {
  if (!extracted.reference) return null
  const admin = createAdminClient()
  const since = new Date(Date.now() - SETTLE_WINDOW_MS).toISOString()
  const { data: recent } = await admin
    .from('expenses')
    .select('id, vendor, amount, reference, additional_receipt_paths, created_at')
    .not('reference', 'is', null)
    .gte('created_at', since)
    .neq('id', selfId)
  const earlier = (recent ?? [])
    .filter((r) => findSameInvoice(extracted, [r]))
    .filter((r) => r.created_at < selfCreatedAt || (r.created_at === selfCreatedAt && r.id < selfId))
    .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : 1) : a.created_at < b.created_at ? -1 : 1))
  const winner = earlier[0]
  if (!winner) return null

  const decision = decideUpload(extracted, winner)
  if (decision.kind === 'insert') return null // clashing totals: both stay, both flagged

  const base = { expenseId: winner.id, vendor: winner.vendor, warning: null, extracted }
  if (decision.kind === 'duplicate') {
    await admin.from('expenses').delete().eq('id', selfId)
    await admin.storage.from(BUCKET).remove([storagePath])
    return { kind: 'duplicate', amount: num(winner.amount), ...base }
  }
  await attach(winner.id, storagePath, decision.kind === 'fill_in' ? extracted : null)
  await admin.from('expenses').delete().eq('id', selfId)
  return {
    kind: 'page',
    amount: decision.kind === 'fill_in' ? extracted.amount : num(winner.amount),
    ...base,
  }
}

/** Add a page to an expense; with `fillIn`, this page also carries the total. */
async function attach(expenseId: string, storagePath: string, fillIn: ExtractedInvoice | null) {
  const admin = createAdminClient()
  // Read-modify-write on the page list: two pages attaching at the same moment
  // can overwrite each other, so check ours stuck and go again if not.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: current } = await admin
      .from('expenses')
      .select('additional_receipt_paths')
      .eq('id', expenseId)
      .single()
    const paths: string[] = current?.additional_receipt_paths ?? []
    if (paths.includes(storagePath)) break
    const { error } = await admin
      .from('expenses')
      .update({ additional_receipt_paths: [...paths, storagePath] })
      .eq('id', expenseId)
    if (error) throw new Error(`Could not add the page: ${error.message}`)
  }

  if (fillIn) {
    const update: Record<string, unknown> = {}
    update.amount = fillIn.amount
    update.vat_rate = fillIn.vat_rate
    update.notes = fillIn.notes
    update.ai_raw = fillIn as unknown as Record<string, unknown>
    update.ai_extracted_at = new Date().toISOString()
    if (fillIn.date) update.date = fillIn.date
    if (fillIn.supplier) update.payee_id = await findOrCreatePayee(fillIn.supplier)
    const { error } = await admin.from('expenses').update(update).eq('id', expenseId)
    if (error) throw new Error(`Could not fill in the total: ${error.message}`)
  }
}

async function findOrCreatePayee(name: string): Promise<string | null> {
  const admin = createAdminClient()
  const clean = name.trim()
  if (!clean) return null
  const { data: existing } = await admin.from('payees').select('id').ilike('name', clean).maybeSingle()
  if (existing) return existing.id
  const { data: created } = await admin
    .from('payees')
    .insert({ name: clean, active: true })
    .select('id')
    .single()
  return created?.id ?? null
}

function num(v: number | string | null | undefined): number | null {
  return v == null ? null : Number(v)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
