/**
 * One expense row per supplier invoice.
 *
 * Receipts arrive as PDFs or as a phone photo per page, and sometimes twice.
 * Before this, each file became its own expense: the page with the total, a
 * £0.00 row for every page without one, and a copy of each when re-uploaded.
 * The invoice number is the natural key, so a further file for the same
 * invoice is either a duplicate (skipped) or another page (attached), never a
 * new row.
 */

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "0128281", "128281" and "0128 281" are one invoice. Too short to trust → null. */
export function normalizeReference(ref: string | null | undefined): string | null {
  if (!ref) return null
  const r = ref.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '')
  return r.length >= 3 ? r : null
}

function cents(v: number | string | null | undefined): number {
  return Math.round(Number(v ?? 0) * 100)
}

function vendorHead(v: string | null | undefined): string {
  return normalize(v ?? '').split(' ')[0] ?? ''
}

export type InvoiceRow = {
  id: string
  vendor: string | null
  amount: number | string | null
  reference: string | null
  additional_receipt_paths: string[] | null
}

export type Extraction = {
  supplier: string | null
  amount: number | null
  reference: string | null
}

/**
 * The row already holding this invoice: the same invoice number, and plausibly
 * the same supplier (same first word of the name, or the same total). The
 * second test stops another supplier's invoice 1234 matching, while still
 * pairing a Booker summary with the Makro till copy of the same invoice.
 */
export function findSameInvoice<T extends InvoiceRow>(extracted: Extraction, rows: T[]): T | null {
  const ref = normalizeReference(extracted.reference)
  if (!ref) return null
  const head = vendorHead(extracted.supplier)
  const amount = cents(extracted.amount)
  return (
    rows.find((row) => {
      if (normalizeReference(row.reference) !== ref) return false
      const sameVendor = head.length >= 3 && vendorHead(row.vendor) === head
      const sameAmount = amount !== 0 && cents(row.amount) === amount
      return sameVendor || sameAmount
    }) ?? null
  )
}

export const NO_TOTAL_WARNING = '⚠ Total not read — check the receipt and enter the amount.'
export const CONFLICT_WARNING = '⚠ Same invoice number as another receipt with a different total — check both.'

export type UploadDecision =
  /** A new expense row, flagged when something needs a person to look. */
  | { kind: 'insert'; warning: string | null }
  /** The same invoice with the same total: drop the file. */
  | { kind: 'duplicate' }
  /** Another page without a total: attach it to the existing row. */
  | { kind: 'attach_page' }
  /** The existing row has no total and this page has it: fill it in and attach. */
  | { kind: 'fill_in' }

export function decideUpload(extracted: Extraction, match: InvoiceRow | null): UploadDecision {
  const amount = cents(extracted.amount)
  if (!match) return { kind: 'insert', warning: amount !== 0 ? null : NO_TOTAL_WARNING }
  if (amount === 0) return { kind: 'attach_page' }
  const matchAmount = cents(match.amount)
  if (matchAmount === 0) return { kind: 'fill_in' }
  if (amount === matchAmount) return { kind: 'duplicate' }
  // Both have totals and they differ: never guess which is right.
  return { kind: 'insert', warning: CONFLICT_WARNING }
}

/**
 * Receipts with no invoice number fall back to this: the same vendor and total
 * within 3 days of an already-reconciled receipt is the same receipt.
 */
export type DupeSignature = {
  vendor_norm: string
  amount_cents: number
  date_bucket: string // ISO date the receipt falls on (we allow ±3 days when comparing)
}

export function signatureOf(e: {
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

export function isSameReceipt(a: DupeSignature, b: DupeSignature): boolean {
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

export function isReconciledRow(row: {
  paid_in_cash: boolean | null
  director_loan_id: string | null
  matched: boolean
}): boolean {
  return row.matched || row.paid_in_cash === true || row.director_loan_id !== null
}
