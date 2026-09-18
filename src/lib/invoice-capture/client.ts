/**
 * Invoice capture: the café app's side of the till's `invoice-capture` edge
 * function (Supabase project sirmwnwllnarqdaqpzhy).
 *
 * The function is not behind a Supabase JWT — it is guarded by a shared key
 * held in the till's `app_settings.invoice_capture_key`. That key must never
 * reach a browser, so everything here runs server-side only: the page reads the
 * supplier list through `captureBootstrap()`, and the browser posts files to
 * /api/invoices/upload, which calls `captureUpload()` with the key attached.
 *
 * Needs TILL_CAPTURE_KEY. TILL_CAPTURE_URL is optional and only needed if
 * the function ever moves.
 */

const DEFAULT_URL =
  'https://sirmwnwllnarqdaqpzhy.supabase.co/functions/v1/invoice-capture'

export type CaptureSupplier = { id: string; name: string }

export type CaptureBootstrap = {
  suppliers: CaptureSupplier[]
  /** Invoices sitting in storage that nobody has checked yet. */
  pending: number
}

function endpoint(action: string): string {
  const base = (process.env.TILL_CAPTURE_URL?.trim() || DEFAULT_URL).replace(/\/+$/, '')
  return `${base}?a=${action}`
}

function key(): string {
  const value = process.env.TILL_CAPTURE_KEY?.trim()
  if (!value) {
    throw new Error(
      'TILL_CAPTURE_KEY is not set, so invoices cannot be sent to the till.',
    )
  }
  return value
}

/** Suppliers to choose from, and how many invoices are waiting to be checked. */
export async function captureBootstrap(): Promise<CaptureBootstrap> {
  const response = await fetch(endpoint('bootstrap'), {
    headers: { 'x-capture-key': key() },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => null)) as
    | { suppliers?: CaptureSupplier[]; pending?: number; error?: string }
    | null

  if (!response.ok || !body || body.error) {
    throw new Error(body?.error ?? `The till answered ${response.status}.`)
  }

  return {
    suppliers: body.suppliers ?? [],
    pending: typeof body.pending === 'number' ? body.pending : 0,
  }
}

/**
 * The waiting count on its own, for dashboards. Never throws: a till that is
 * down should not take the owner's dashboard with it.
 */
export async function capturePendingCount(): Promise<number | null> {
  try {
    return (await captureBootstrap()).pending
  } catch {
    return null
  }
}

/**
 * Send one invoice. `capturedBy` is the signed-in person's name, so the record
 * says who photographed it.
 */
export async function captureUpload(
  file: File,
  supplierId: string | null,
  capturedBy: string,
): Promise<{ invoice_id?: string; error?: string; status: number }> {
  const form = new FormData()
  form.append('file', file, file.name)
  if (supplierId) form.append('supplier_id', supplierId)
  if (capturedBy) form.append('captured_by', capturedBy)
  // The café app reads it straight away (src/lib/invoices/ingest.ts), so it
  // goes in already claimed and the catch-up leaves it alone.
  form.append('state', 'extracting')

  const response = await fetch(endpoint('upload'), {
    method: 'POST',
    headers: { 'x-capture-key': key() },
    body: form,
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => null)) as
    | { invoice_id?: string; error?: string }
    | null

  if (!response.ok || !body || body.error) {
    return {
      error: body?.error ?? `The till answered ${response.status}.`,
      status: response.ok ? 502 : response.status,
    }
  }
  return { invoice_id: body.invoice_id, status: 200 }
}

export type WaitingInvoice = {
  id: string
  state: string
  file_name: string | null
  captured_by: string | null
  captured_at: string
  supplier: string | null
  /** Signed, good for ten minutes. */
  url: string | null
}

async function post(action: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint(action), {
    method: 'POST',
    headers: { 'x-capture-key': key(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok || !data || data.error) {
    throw new Error(String(data?.error ?? `The till answered ${response.status}.`))
  }
  return data
}

/** Invoices in the till nobody has read into the books yet, oldest first. */
export async function captureWaiting(): Promise<WaitingInvoice[]> {
  const response = await fetch(endpoint('waiting'), {
    headers: { 'x-capture-key': key() },
    cache: 'no-store',
  })
  const body = (await response.json().catch(() => null)) as
    | { invoices?: WaitingInvoice[]; error?: string }
    | null
  if (!response.ok || !body || body.error) {
    throw new Error(body?.error ?? `The till answered ${response.status}.`)
  }
  return body.invoices ?? []
}

/** Take one for reading. False when another reader already has it. */
export async function captureClaim(id: string): Promise<boolean> {
  return (await post('claim', { id })).claimed === true
}

/**
 * Report how the read went. `confirmed` takes it off the waiting count and
 * records what was read; `failed` leaves it waiting for the next catch-up.
 * Totals in pence, as the till keeps them.
 */
export async function captureResult(
  id: string,
  outcome:
    | {
        state: 'confirmed'
        invoice_no: string | null
        invoice_date: string | null
        total_gross: number | null
        total_net: number | null
        reviewed_by: string
      }
    | { state: 'failed' },
): Promise<void> {
  await post('result', { id, ...outcome })
}

export function toPence(pounds: number | null | undefined): number | null {
  return pounds == null || !Number.isFinite(pounds) ? null : Math.round(pounds * 100)
}
