import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function StockListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: items } = await admin
    .from('stock_items')
    .select('id, sku, name, category, unit, par_level, cost_price, supplier_name, active')
    .order('active', { ascending: false })
    .order('category')
    .order('name')

  return (
    <main className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Stock items
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Things you count and waste. Suppliers + orders land in Phase 3.
          </p>
        </div>
        <Link
          href="/owner/stock/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add item
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3 text-right">Par</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => (
              <tr
                key={it.id}
                className={`border-t border-brand-sage/30 ${
                  it.active ? '' : 'text-brand-slate'
                }`}
              >
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {it.name}
                  {it.sku && (
                    <span className="ml-2 text-xs text-brand-slate">
                      {it.sku}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {it.category ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs">{it.unit}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {it.par_level ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  {it.cost_price == null ? '—' : `£${Number(it.cost_price).toFixed(2)}`}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {it.supplier_name ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {it.active ? (
                    <span className="text-brand-teal-deep">Active</span>
                  ) : (
                    <span className="text-brand-slate">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/stock/${it.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(items?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No items yet. Add a few — e.g. &quot;Coffee beans&quot;,
                  &quot;Whole milk&quot;, &quot;Sugar sachets&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
