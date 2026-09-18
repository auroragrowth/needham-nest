import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { captureBootstrap } from '@/lib/invoice-capture/client'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Capture, type ForPayment } from './Capture'

export const dynamic = 'force-dynamic'

/**
 * The one place invoices and receipts come in. Pick the supplier, add photos
 * or PDFs, upload. Each file is saved in the till (for costing, later) and
 * read into the café's expenses (for the bank) — see
 * src/lib/invoice-capture/read.ts.
 *
 * The supplier list and the waiting count are fetched server-side so the till's
 * shared key never reaches the browser; files go out through
 * /api/invoices/upload for the same reason.
 */

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
  })
}
export default async function InvoiceCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login?next=%2Finvoices')

  // Opened from Receipts to find: this upload is for one bank payment.
  const { for: forId } = await searchParams
  let forPayment: ForPayment | null = null
  if (session.role === 'owner' && forId && /^[0-9a-f-]{36}$/i.test(forId)) {
    const { data: line } = await createAdminClient()
      .from('bank_transactions')
      .select('id, date, amount, description, raw_row, matched_expense_id')
      .eq('id', forId)
      .maybeSingle()
    if (line && !line.matched_expense_id) {
      const raw = line.raw_row as Record<string, string> | null
      forPayment = {
        id: line.id,
        payee: raw?.name?.trim() || line.description.split(' · ')[0],
        amount: -Number(line.amount),
        date: line.date,
      }
    }
  }

  let suppliers: { id: string; name: string }[] = []
  let pending: number | null = null
  let error: string | null = null

  // What this person has sent in, as read into the books — confirmation it
  // worked, carried over from the old "Snap a receipt" page.
  const { data: recent } = await createAdminClient()
    .from('expenses')
    .select('id, date, vendor, amount, reference')
    .eq('user_id', session.profileId)
    .order('created_at', { ascending: false })
    .limit(10)

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
        Invoice or receipt
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Say who it&apos;s from, then add a photo or PDF — as many as you like. Each one
        is read straight into the books, ready to match against the bank.
      </p>

      {error ? (
        <p className="mt-6 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {error} Nothing can be uploaded until the till answers again.
        </p>
      ) : (
        <>
          {forPayment && (
            <p className="mt-6 rounded-xl border border-brand-amber bg-brand-amber/10 p-4 text-sm text-brand-forest">
              Receipt for <strong>{forPayment.payee}</strong>, £{forPayment.amount.toFixed(2)} on{' '}
              {fmtDate(forPayment.date)}. Whatever name is on it, it will be matched to this
              payment.{' '}
              <Link href="/owner/receipts-to-find" className="text-brand-amber hover:underline">
                ← Receipts to find
              </Link>
            </p>
          )}
          <Capture suppliers={suppliers} pending={pending ?? 0} forPayment={forPayment} />
        </>
      )}

      {(recent?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Your recent uploads
          </h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
            {(recent ?? []).map((r) => (
              <li
                key={r.id}
                className="flex items-baseline gap-3 border-b border-brand-sage/30 px-4 py-3 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-brand-forest">
                  {r.vendor ?? 'Unknown supplier'}
                  {r.reference && (
                    <span className="ml-2 text-xs text-brand-slate">{r.reference}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-brand-slate">{fmtDate(r.date)}</span>
                <span className="shrink-0 font-mono text-sm text-brand-forest">
                  £{Number(r.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
