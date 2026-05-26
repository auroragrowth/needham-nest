import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-brand-sage/20 text-brand-forest',
  sent: 'bg-brand-teal/15 text-brand-teal-deep',
  paid: 'bg-brand-teal-deep text-brand-cream',
  overdue: 'bg-brand-amber/30 text-brand-forest',
}

export default async function InvoicesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('invoices')
    .select('id, invoice_number, date, due_date, customer_snapshot, total, status')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  const unpaidTotal = (rows ?? [])
    .filter((r) => r.status !== 'paid')
    .reduce((a, r) => a + Number(r.total ?? 0), 0)

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            For occasional B2B catering / function bookings.
          </p>
        </div>
        <Link
          href="/owner/invoices/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + New invoice
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <p className="text-sm text-brand-slate">Outstanding (not paid)</p>
        <p className="mt-1 text-3xl font-semibold text-brand-forest">
          £{unpaidTotal.toFixed(2)}
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Invoice no.</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const cust =
                typeof r.customer_snapshot === 'object' && r.customer_snapshot
                  ? (r.customer_snapshot as { name?: string }).name ?? 'Unknown'
                  : 'Unknown'
              return (
                <tr key={r.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 font-mono text-brand-forest">
                    {r.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-brand-forest">{cust}</td>
                  <td className="px-4 py-3 text-brand-forest">
                    {new Date(r.date).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-forest">
                    £{Number(r.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[r.status] ?? ''}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/owner/invoices/${r.id}`}
                      className="text-sm font-medium text-brand-amber hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
