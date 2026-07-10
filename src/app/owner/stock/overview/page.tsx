import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

type Item = {
  id: string
  name: string
  unit: string
  par_level: number | null
  category: string | null
}
type Location = { id: string; name: string; zone: string }

export default async function StockOverviewPage() {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')

  const admin = createAdminClient()
  const [{ data: items }, { data: locations }, { data: placements }] =
    await Promise.all([
      admin
        .from('stock_items')
        .select('id, name, unit, par_level, category')
        .eq('active', true)
        .order('name'),
      admin
        .from('stock_locations')
        .select('id, name, zone')
        .eq('active', true)
        .order('sort_order')
        .order('name'),
      admin.from('stock_placements').select('stock_item_id, location_id, quantity'),
    ])

  const its = (items ?? []) as Item[]
  const locs = (locations ?? []) as Location[]

  const cellKey = (i: string, l: string) => `${i}::${l}`
  const cell = new Map<string, number>()
  const totalByItem = new Map<string, number>()
  for (const p of placements ?? []) {
    const q = Number(p.quantity)
    cell.set(cellKey(p.stock_item_id, p.location_id), q)
    totalByItem.set(
      p.stock_item_id,
      (totalByItem.get(p.stock_item_id) ?? 0) + q,
    )
  }

  return (
    <main className="mx-auto max-w-6xl">
      <Link href="/owner" className="text-sm text-brand-amber hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Stock overview
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Every item × every location. Total across the shop on the right,
            with par level shown for reference.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/owner/stock/locations"
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            Manage locations
          </Link>
          <Link
            href="/owner/stock/alerts"
            className="rounded-lg bg-brand-amber px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
          >
            Below-par alerts
          </Link>
        </div>
      </div>

      {its.length === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6 text-sm text-brand-slate">
          No stock items yet.{' '}
          <Link href="/owner/stock/new" className="text-brand-amber underline">
            Add your first item →
          </Link>
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-brand-sage/40 bg-brand-cream px-3 py-2 text-left font-semibold text-brand-slate">
                  Item
                </th>
                {locs.map((l) => (
                  <th
                    key={l.id}
                    className="border-b border-brand-sage/40 px-2 py-2 text-right font-semibold text-brand-slate"
                    title={l.name}
                  >
                    {l.name}
                  </th>
                ))}
                <th className="border-b border-brand-forest px-3 py-2 text-right font-semibold text-brand-forest">
                  Total
                </th>
                <th className="border-b border-brand-sage/40 px-3 py-2 text-right font-semibold text-brand-slate">
                  Par
                </th>
              </tr>
            </thead>
            <tbody>
              {its.map((i) => {
                const total = totalByItem.get(i.id) ?? 0
                const below =
                  i.par_level != null && total <= Number(i.par_level)
                return (
                  <tr key={i.id} className={below ? 'bg-brand-amber/10' : ''}>
                    <td className="sticky left-0 z-10 border-b border-brand-sage/30 bg-inherit px-3 py-1.5">
                      <span className="font-semibold text-brand-forest">
                        {i.name}
                      </span>
                      <span className="ml-1 text-brand-slate">({i.unit})</span>
                    </td>
                    {locs.map((l) => {
                      const v = cell.get(cellKey(i.id, l.id))
                      return (
                        <td
                          key={l.id}
                          className="border-b border-brand-sage/30 px-2 py-1.5 text-right font-mono"
                        >
                          {v === undefined ? '·' : Number(v).toFixed(0)}
                        </td>
                      )
                    })}
                    <td
                      className={`border-b border-brand-forest px-3 py-1.5 text-right font-mono font-semibold ${
                        below ? 'text-brand-amber' : 'text-brand-forest'
                      }`}
                    >
                      {total.toFixed(0)}
                      {below && ' ⚠'}
                    </td>
                    <td className="border-b border-brand-sage/30 px-3 py-1.5 text-right font-mono text-brand-slate">
                      {i.par_level ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
