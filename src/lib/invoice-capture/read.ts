import { createAdminClient } from '@/lib/supabase/admin'
import { ingestInvoice, type IngestResult } from '@/lib/invoices/ingest'
import { autoMatchExpenses, linkBankLine } from '@/lib/invoices/match'
import { markPaidInCash } from '@/lib/invoices/cash'
import {
  captureClaim,
  captureResult,
  captureWaiting,
  toPence,
  type WaitingInvoice,
} from './client'

/**
 * Reading captured invoices into the books.
 *
 * Every file saved through /invoices goes to the till (for costing, later)
 * and is read straight away into the café's expenses (for the bank). The till
 * is then told how it went: `confirmed` with the invoice number, date and
 * totals, which takes it off the "waiting to be checked" count; or `failed`,
 * which leaves it waiting.
 *
 * Anything still waiting — a failed read, a read cut off by a closed tab, or a
 * file sent from the old standalone page — is picked up by `readWaiting()`:
 * the cron every 15 minutes, or the owner's button on Invoice reconciliation.
 */

/**
 * Read one file into the books, tell the till, then check the books against
 * the bank. Never throws.
 */
export async function readIntoBooks(input: {
  tillInvoiceId: string
  bytes: ArrayBuffer
  fileName: string
  contentType: string
  profileId: string
  readerName: string
  supplierHint: string | null
  /** Ticked "Paid cash from the till" at upload: settle it now, not against the bank. */
  paidCash?: boolean
  /** Uploaded from Receipts to find for this bank payment: match it to that one. */
  bankLineId?: string | null
}): Promise<
  | { ok: true; result: IngestResult; paidCash: boolean; linked: 'linked' | 'already' | 'taken' | null }
  | { ok: false; error: string }
> {
  let result: IngestResult
  try {
    result = await ingestInvoice(input)
  } catch (e) {
    await captureResult(input.tillInvoiceId, { state: 'failed' }).catch(() => {})
    return { ok: false, error: e instanceof Error ? e.message : 'Could not read it.' }
  }

  // The till holds one record per supplier invoice number (a unique index), so
  // only the file that made the expense carries the number and totals. Extra
  // pages and repeat photos are confirmed bare: they're read, nothing to wait on.
  const x = result.extracted
  const confirmed =
    result.kind === 'new'
      ? {
          state: 'confirmed' as const,
          invoice_no: x.reference,
          invoice_date: x.date,
          total_gross: toPence(x.amount),
          total_net: toPence(x.amount_net),
          reviewed_by: input.readerName,
        }
      : bare(input.readerName)
  try {
    await captureResult(input.tillInvoiceId, confirmed)
  } catch (e) {
    // Most likely the same invoice number is already on another till record
    // (say, a repeat photo filed under a different supplier). Still confirm it,
    // or it would be read again every 15 minutes.
    console.error('invoice-capture: result not recorded in the till, confirming bare', e)
    await captureResult(input.tillInvoiceId, bare(input.readerName)).catch((e2) =>
      console.error('invoice-capture: bare confirm failed too', e2),
    )
  }

  // Paid from the till: settled now. Otherwise check it off against the bank
  // straight away if the statement is already in. A repeat photo changes neither.
  // Uploaded for a particular bank payment: that pairing wins over any guess.
  let linked: 'linked' | 'already' | 'taken' | null = null
  if (input.bankLineId && result.expenseId) {
    linked = await linkBankLine(input.bankLineId, result.expenseId).catch((e) => {
      console.error('invoice-capture: could not link the bank payment', e)
      return null
    })
  }

  let paidCash = false
  if (result.kind !== 'duplicate' && result.expenseId) {
    if (input.paidCash && !input.bankLineId) {
      paidCash = await markPaidInCash(result.expenseId, input.profileId).catch((e) => {
        console.error('invoice-capture: could not mark paid in cash', e)
        return false
      })
    }
    await autoMatchExpenses().catch((e) => console.error('invoice-capture: auto-match failed', e))
  }
  return { ok: true, result, paidCash, linked }
}

function bare(readerName: string) {
  return {
    state: 'confirmed' as const,
    invoice_no: null,
    invoice_date: null,
    total_gross: null,
    total_net: null,
    reviewed_by: readerName,
  }
}

export type ReadWaitingSummary = {
  read: number
  failed: number
  skipped: number
  errors: string[]
}

/** Read everything the till says is waiting. One at a time, oldest first. */
export async function readWaiting(): Promise<ReadWaitingSummary> {
  const summary: ReadWaitingSummary = { read: 0, failed: 0, skipped: 0, errors: [] }
  const waiting = await captureWaiting()
  if (waiting.length === 0) return summary

  const people = await profilesByName()
  for (const invoice of waiting) {
    if (!invoice.url || !(await captureClaim(invoice.id))) {
      summary.skipped += 1
      continue
    }
    const name = label(invoice)
    const bytes = await download(invoice.url)
    if (!bytes) {
      await captureResult(invoice.id, { state: 'failed' }).catch(() => {})
      summary.failed += 1
      summary.errors.push(`${name}: could not fetch the file from the till`)
      continue
    }
    const uploader = people.byName.get(norm(invoice.captured_by)) ?? people.owner
    if (!uploader) {
      await captureResult(invoice.id, { state: 'failed' }).catch(() => {})
      summary.failed += 1
      summary.errors.push(`${name}: nobody to file it under`)
      continue
    }
    const outcome = await readIntoBooks({
      tillInvoiceId: invoice.id,
      bytes: bytes.data,
      fileName: invoice.file_name || `${invoice.id}.jpg`,
      contentType: bytes.type,
      profileId: uploader.id,
      readerName: invoice.captured_by ?? uploader.name,
      supplierHint: invoice.supplier,
    })
    if (outcome.ok) summary.read += 1
    else {
      summary.failed += 1
      summary.errors.push(`${name}: ${outcome.error}`)
    }
  }
  return summary
}

function label(invoice: WaitingInvoice): string {
  return [invoice.supplier, invoice.file_name].filter(Boolean).join(' — ') || invoice.id
}

async function download(url: string): Promise<{ data: ArrayBuffer; type: string } | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    return {
      data: await response.arrayBuffer(),
      type: response.headers.get('content-type') ?? '',
    }
  } catch {
    return null
  }
}

function norm(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

/**
 * The till keeps the photographer's name; the café's expenses want a profile
 * id. Match on name, and fall back to the owner.
 */
async function profilesByName() {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('id, name, role, active').eq('active', true)
  const rows = data ?? []
  return {
    byName: new Map(rows.map((p) => [norm(p.name), { id: p.id, name: p.name }])),
    owner: rows
      .filter((p) => p.role === 'owner')
      .map((p) => ({ id: p.id, name: p.name }))[0],
  }
}
