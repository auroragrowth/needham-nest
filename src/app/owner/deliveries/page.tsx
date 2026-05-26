import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

type Item = {
  stock_item_id: string
  quantity: number
  unit_cost: number
}

export default async function DeliveriesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [{ data: rows }, { data: suppliers }] = await Promise.all([
    admin
      .from('deliveries')
      .select('id, supplier_id, date, items, total, reference')
      .gte('date', since)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('suppliers').select('id, name'),
  ])

  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]))
  const total = (rows ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0)

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Deliveries
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Stock arrived from suppliers. Each delivery also creates the
            matching expense automatically.
          </p>
        </div>
        <Link
          href="/owner/deliveries/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Record delivery
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <p className="text-sm text-brand-slate">Total (90d)</p>
        <p className="mt-1 text-3xl font-semibold text-brand-forest">
          £{total.toFixed(2)}
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Reference</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const items = (r.items ?? []) as Item[]
              return (
                <tr key={r.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 text-brand-forest">
                    {new Date(r.date).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-brand-forest">
                    {supplierNameById.get(r.supplier_id) ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-right text-brand-slate">
                    {items.length}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-forest">
                    £{Number(r.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-slate">
                    {r.reference ?? '—'}
                  </td>
                </tr>
              )
            })}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No deliveries recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
