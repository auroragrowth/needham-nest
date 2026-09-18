import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { captureUpload } from '@/lib/invoice-capture/client'

export const dynamic = 'force-dynamic'
// One photo per request, but a poor back-door signal makes even one slow.
export const maxDuration = 60

/**
 * The browser's way in to the till's invoice-capture function. The shared key
 * stays here; the browser only ever sends the file and which supplier it is
 * from. Who photographed it comes from the session, not the request, so it
 * cannot be spoofed.
 *
 * POST multipart: `file`, optional `supplier_id`. Returns { invoice_id }.
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

  try {
    const result = await captureUpload(file, supplierId, session.name)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ invoice_id: result.invoice_id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not reach the till.' },
      { status: 502 },
    )
  }
}
