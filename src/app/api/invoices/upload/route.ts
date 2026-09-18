import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { captureUpload } from '@/lib/invoice-capture/client'
import { readIntoBooks } from '@/lib/invoice-capture/read'

export const dynamic = 'force-dynamic'
// One photo per request, but a poor back-door signal makes even one slow, and
// reading it with Claude takes another 5–20 seconds.
export const maxDuration = 120

/**
 * The one way paperwork comes in. The file goes to the till's invoice-capture
 * function (costing, later) and is then read into the café's expenses (bank
 * reconciliation, now) — see src/lib/invoice-capture/read.ts.
 *
 * The shared key stays here; the browser only ever sends the file and which
 * supplier it is from. Who photographed it comes from the session, not the
 * request, so it cannot be spoofed.
 *
 * POST multipart: `file`, optional `supplier_id`, optional `supplier_name`,
 * optional `paid_cash=1` (paid from the till: settled now, not against the bank),
 * optional `bank_line_id` (owner only, from Receipts to find: match to that payment).
 * Returns { invoice_id, read } — `read` says what the books now hold, or
 * `read_error` when it couldn't be read (it stays waiting and is retried).
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'That upload did not arrive in one piece.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file in that upload.' }, { status: 400 })
  }

  const supplierRaw = form.get('supplier_id')
  const supplierId = typeof supplierRaw === 'string' && supplierRaw.trim() ? supplierRaw.trim() : null

  const supplierNameRaw = form.get('supplier_name')
  const supplierName =
    typeof supplierNameRaw === 'string' && supplierNameRaw.trim() ? supplierNameRaw.trim() : null

  let invoiceId: string
  try {
    const result = await captureUpload(file, supplierId, session.name)
    if (result.error || !result.invoice_id) {
      return NextResponse.json(
        { error: result.error ?? 'The till did not say it was saved.' },
        { status: result.error ? result.status : 502 },
      )
    }
    invoiceId = result.invoice_id
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not reach the till.' },
      { status: 502 },
    )
  }

  // Saved in the till: from here on the upload has worked, whatever the read does.
  const outcome = await readIntoBooks({
    tillInvoiceId: invoiceId,
    bytes: await file.arrayBuffer(),
    fileName: file.name,
    contentType: file.type,
    profileId: session.profileId,
    readerName: session.name,
    supplierHint: supplierName,
    paidCash: form.get('paid_cash') === '1',
    bankLineId: session.role === 'owner' ? bankLineId(form) : null,
  })
  if (!outcome.ok) {
    return NextResponse.json({ invoice_id: invoiceId, read: null, read_error: outcome.error })
  }
  const r = outcome.result
  return NextResponse.json({
    invoice_id: invoiceId,
    read: {
      kind: r.kind,
      vendor: r.vendor,
      amount: r.amount,
      warning: r.warning,
      paid_cash: outcome.paidCash,
      linked: outcome.linked,
    },
  })
}

function bankLineId(form: FormData): string | null {
  const v = form.get('bank_line_id')
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null
}
