import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadAndExtractInvoices } from '@/lib/invoices/actions'

export const dynamic = 'force-dynamic'

function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return `£${Number(n).toFixed(2)}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; errors?: string }>
}) {
  const sp = await searchParams
  const admin = createAdminClient()

  // Load the 30 most recent uploads with their reconciliation status
  // computed inline so the page can tell Paul "matched" / "flagged" at a
  // glance.
  const [{ data: receiptsRaw }, { data: txnsRaw }] = await Promise.all([
    admin
      .from('expenses')
      .select(
        'id, date, vendor, amount, reference, receipt_path, ai_extracted, director_loan_id, created_at',
      )
      .eq('ai_extracted', true)
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('bank_transactions')
      .select('matched_expense_id')
      .not('matched_expense_id', 'is', null),
  ])

  const matchedSet = new Set(
    (txnsRaw ?? []).map((t) => t.matched_expense_id!),
  )
  const receipts = receiptsRaw ?? []
  const totalFlagged = receipts.filter(
    (r) => !matchedSet.has(r.id) && !r.director_loan_id,
  ).length

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Snap a receipt
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Take a photo or pick a file. The system reads the supplier and
        amount, then checks the bank statement automatically.
      </p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.errors && (
        <p className="mt-2 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-xs text-brand-forest">
          {sp.errors}
        </p>
      )}

      {/* Big camera-first button — iOS Safari opens the camera straight
          away thanks to capture="environment". */}
      <form
        action={uploadAndExtractInvoices}
        encType="multipart/form-data"
        className="mt-6 rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-6 text-center"
      >
        <input
          id="files"
          name="files"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
          capture="environment"
          required
          className="hidden"
        />
        <label
          htmlFor="files"
          className="block cursor-pointer text-brand-forest"
          style={{ touchAction: 'manipulation' }}
        >
          <span className="text-5xl" aria-hidden>
            📸
          </span>
          <span className="mt-2 block text-lg font-semibold">
            Snap or pick a receipt
          </span>
          <span className="mt-1 block text-xs text-brand-slate">
            iPhone / iPad: opens the camera. Laptop: opens the file picker.
          </span>
        </label>
        <button
          type="submit"
          className="mt-4 w-full rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{ minHeight: '44px' }}
        >
          Upload &amp; scan
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/owner/invoices-upload"
          className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-xs text-brand-forest hover:bg-brand-sage/10"
        >
          Bulk upload (multiple files) →
        </Link>
        <Link
          href="/owner/invoices-reconcile"
          className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-xs text-brand-forest hover:bg-brand-sage/10"
        >
          Reconciliation page →
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Recent receipts
          {totalFlagged > 0 && (
            <span className="ml-2 rounded bg-brand-amber/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-amber">
              {totalFlagged} flagged
            </span>
          )}
        </h2>
        {receipts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
            No receipts scanned yet. Snap one above to get started.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {receipts.map((r) => {
              const matched = matchedSet.has(r.id)
              const directorPaid = !!r.director_loan_id
              return (
                <li
                  key={r.id}
                  className={`flex items-baseline justify-between gap-3 rounded-xl border p-3 ${
                    directorPaid
                      ? 'border-brand-sage/40 bg-white'
                      : matched
                        ? 'border-brand-teal/40 bg-brand-teal/5'
                        : 'border-brand-amber/60 bg-brand-amber/5'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-brand-forest">
                      {r.vendor ?? 'Unknown supplier'}
                      <span className="ml-2 font-mono text-sm">
                        {fmtMoney(Number(r.amount))}
                      </span>
                    </p>
                    <p className="text-xs text-brand-slate">
                      {fmtDate(r.date)}
                      {r.reference && ` · ${r.reference}`}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-semibold">
                    {directorPaid
                      ? '🏛 Director loan'
                      : matched
                        ? '✓ Matched bank'
                        : '⚠ Flagged'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
