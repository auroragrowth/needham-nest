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
