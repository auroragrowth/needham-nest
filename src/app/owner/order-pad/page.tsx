import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { PrintButton } from '@/components/shared/PrintButton'
import './print.css'

type StockItem = {
  id: string
  name: string
  unit: string
  par_level: number | null
  reorder_at: number | null
  cost_price: number | null
  supplier_name: string | null
  category: string | null
}

export default async function OrderPadPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session || (session.role !== 'owner' && session.role !== 'manager')) {
    redirect('/login')
  }

  const admin = createAdminClient()

  const [
    { data: items },
    { data: counts },
    { data: placements },
    { data: settings },
  ] = await Promise.all([
    admin
      .from('stock_items')
      .select('id, name, unit, par_level, reorder_at, cost_price, supplier_name, category')
      .eq('active', true)
      .order('supplier_name', { nullsFirst: false })
      .order('category')
      .order('name'),
    admin
      .from('stock_counts')
      .select('stock_item_id, on_hand, date')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    admin.from('stock_placements').select('stock_item_id, quantity'),
    session.authUserId
      ? admin
          .from('settings')
          .select('company_name')
          .eq('user_id', session.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
  ])

  // Prefer live placement sums (source of truth for the new location system).
  // Fall back to latest stock_counts row if an item has no placements at all.
  const totalByPlacement = new Map<string, number>()
  for (const p of placements ?? []) {
    totalByPlacement.set(
      p.stock_item_id,
      (totalByPlacement.get(p.stock_item_id) ?? 0) + Number(p.quantity),
    )
  }
  const latestByItem = new Map<string, number>()
  for (const c of counts ?? []) {
    if (!latestByItem.has(c.stock_item_id)) {
      latestByItem.set(c.stock_item_id, Number(c.on_hand))
    }
  }
  for (const [id, qty] of totalByPlacement) {
    latestByItem.set(id, qty)
  }

  // Filter: items below par (or no par set and no recent count, surface them too)
  const needToOrder = ((items ?? []) as StockItem[]).filter((it) => {
    if (it.par_level == null) return false
    const current = latestByItem.get(it.id)
    if (current === undefined) return true // never counted — show
    return current < it.par_level
  })

  // Group by supplier
  const bySupplier = new Map<string, StockItem[]>()
  for (const it of needToOrder) {
    const k = it.supplier_name ?? '(no supplier)'
    if (sp.supplier && sp.supplier !== 'all' && sp.supplier !== k) continue
    const arr = bySupplier.get(k) ?? []
    arr.push(it)
    bySupplier.set(k, arr)
  }

  const allSuppliers = Array.from(
    new Set(
      ((items ?? []) as StockItem[])
        .map((i) => i.supplier_name)
        .filter((s): s is string => Boolean(s)),
    ),
  ).sort()

  const companyName = settings?.company_name ?? 'Needham Nest Café'
  const today = new Date().toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="pack mx-auto max-w-3xl bg-white p-6 text-sm text-black print:max-w-none">
      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-lg border border-brand-sage/40 bg-brand-cream p-4">
        <div>
          <Link
            href="/owner"
            className="text-sm text-brand-amber hover:underline"
          >
            ← Back to dashboard
          </Link>
          <p className="mt-1 text-sm text-brand-slate">
            Items below par based on the latest stock count. Items never
            counted are also shown.
          </p>
          {allSuppliers.length > 0 && (
            <form className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-brand-slate">
                  Filter by supplier
                </label>
                <select
                  name="supplier"
                  defaultValue={sp.supplier ?? 'all'}
                  className="rounded border border-brand-sage/60 px-2 py-1 text-sm"
                >
                  <option value="all">All suppliers</option>
                  {allSuppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg border border-brand-forest px-3 py-1.5 text-sm font-medium text-brand-forest hover:bg-brand-forest hover:text-brand-cream"
              >
                Update
              </button>
            </form>
          )}
        </div>
        <PrintButton />
      </div>

      <section className="pack-section border-b border-black/20 pb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-black/70">
          Order pad
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{companyName}</h1>
        <p className="mt-1 text-xs text-black/60">Generated {today}</p>
      </section>

      {bySupplier.size === 0 ? (
        <p className="mt-6 rounded border border-black/20 p-5 text-center text-sm">
          Nothing to order — all stock at or above par.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {Array.from(bySupplier.entries()).map(([supplier, list]) => {
            const supplierTotal = list.reduce((a, it) => {
              const cur = latestByItem.get(it.id) ?? 0
              const need = Math.max(0, (it.par_level ?? 0) - cur)
              return a + need * Number(it.cost_price ?? 0)
            }, 0)
            return (
              <section key={supplier} className="pack-section">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-semibold">{supplier}</h2>
                  <p className="text-xs text-black/60">
                    Est. £{supplierTotal.toFixed(2)}
                  </p>
                </div>
                <table className="mt-2 w-full border-collapse text-xs">
                  <thead className="bg-black/5 text-left">
                    <tr>
                      <th className="border border-black/20 px-2 py-1">Item</th>
                      <th className="border border-black/20 px-2 py-1 text-right">
                        Par
                      </th>
                      <th className="border border-black/20 px-2 py-1 text-right">
                        On hand
                      </th>
                      <th className="border border-black/20 px-2 py-1 text-right">
                        Order
                      </th>
                      <th className="border border-black/20 px-2 py-1 text-right">
                        Est. cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((it) => {
                      const cur = latestByItem.get(it.id)
                      const par = it.par_level ?? 0
                      const order =
                        cur === undefined
                          ? par
                          : Math.max(0, par - cur)
                      const cost = order * Number(it.cost_price ?? 0)
                      return (
                        <tr key={it.id}>
                          <td className="border border-black/20 px-2 py-1">
                            {it.name}
                            <span className="ml-1 text-black/50">
                              ({it.unit})
                            </span>
                          </td>
                          <td className="border border-black/20 px-2 py-1 text-right font-mono">
                            {par}
                          </td>
                          <td className="border border-black/20 px-2 py-1 text-right font-mono">
                            {cur === undefined ? '?' : cur}
                          </td>
                          <td className="border border-black/20 px-2 py-1 text-right font-mono font-semibold">
                            {order}
                          </td>
                          <td className="border border-black/20 px-2 py-1 text-right font-mono">
                            £{cost.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
