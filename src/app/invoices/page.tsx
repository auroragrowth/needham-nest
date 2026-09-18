import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { captureBootstrap } from '@/lib/invoice-capture/client'
import { Capture } from './Capture'

export const dynamic = 'force-dynamic'

/**
 * Invoice capture: get the paperwork off the counter and into the till's
 * storage. Pick the supplier, add photos or PDFs, upload.
 *
 * Nothing is read or costed here — that comes later, in the finance agent. The
 * supplier list and the waiting count are fetched server-side so the till's
 * shared key never reaches the browser; files go out through
 * /api/invoices/upload for the same reason.
 */
export default async function InvoiceCapturePage() {
  const session = await getSession()
  if (!session) redirect('/login?next=%2Finvoices')

  let suppliers: { id: string; name: string }[] = []
  let pending: number | null = null
  let error: string | null = null

  try {
    const boot = await captureBootstrap()
    suppliers = boot.suppliers
    pending = boot.pending
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not reach the till.'
  }

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Upload invoices
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Say who they are from, then add as many as you like. Photos or PDFs.
      </p>

      {error ? (
        <p className="mt-6 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {error} Nothing can be uploaded until the till answers again.
        </p>
      ) : (
        <Capture suppliers={suppliers} pending={pending ?? 0} />
      )}
    </main>
  )
}
