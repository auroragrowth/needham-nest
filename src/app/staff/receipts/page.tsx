import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadAndExtractInvoices } from '@/lib/invoices/actions'

export const dynamic = 'force-dynamic'

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return `£${Number(n).toFixed(2)}`
}

export default async function StaffReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; errors?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  // Show this staff member's most recently uploaded receipts. Useful
  // both as confirmation it worked and so they can see their own
  // contributions.
  const admin = createAdminClient()
  const { data: receipts } = await admin
    .from('expenses')
    .select('id, date, vendor, amount, reference, ai_extracted, created_at')
    .eq('user_id', session.authUserId ?? '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Tablet
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Snap a receipt
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Bought something for the café? Take a photo and the system reads
        the supplier and amount. Paul gets the file straight away.
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
            Camera opens straight away on iPad / iPhone.
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

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Your recent uploads
        </h2>
        {(receipts?.length ?? 0) === 0 ? (
          <p className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
            Nothing yet. Snap one above.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(receipts ?? []).map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-brand-sage/40 bg-white p-3 text-sm"
              >
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
