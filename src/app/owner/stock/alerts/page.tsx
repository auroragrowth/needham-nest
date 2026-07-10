import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { setParLevel } from '@/lib/stock-locations/actions'

export const dynamic = 'force-dynamic'

type Item = {
  id: string
  name: string
  unit: string
  par_level: number | null
  supplier_name: string | null
}
type Location = { id: string; name: string }

export default async function StockAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')
  const sp = await searchParams

  const admin = createAdminClient()
  const [{ data: items }, { data: locations }, { data: placements }] =
    await Promise.all([
      admin
        .from('stock_items')
        .select('id, name, unit, par_level, supplier_name')
        .eq('active', true)
        .order('name'),
      admin
        .from('stock_locations')
        .select('id, name')
        .eq('active', true),
      admin.from('stock_placements').select('stock_item_id, location_id, quantity'),
    ])

  const its = (items ?? []) as Item[]
  const locs = (locations ?? []) as Location[]
  const locNameById = new Map(locs.map((l) => [l.id, l.name]))

  const totalByItem = new Map<string, number>()
  const locBreakdown = new Map<string, Array<{ location: string; qty: number }>>()
  for (const p of placements ?? []) {
    const q = Number(p.quantity)
    totalByItem.set(p.stock_item_id, (totalByItem.get(p.stock_item_id) ?? 0) + q)
    if (q > 0) {
      const arr = locBreakdown.get(p.stock_item_id) ?? []
      arr.push({ location: locNameById.get(p.location_id) ?? '?', qty: q })
      locBreakdown.set(p.stock_item_id, arr)
    }
  }

  const below = its
    .filter((i) => i.par_level != null && (totalByItem.get(i.id) ?? 0) <= Number(i.par_level))
    .map((i) => ({
      ...i,
      total: totalByItem.get(i.id) ?? 0,
      gap: Number(i.par_level) - (totalByItem.get(i.id) ?? 0),
      where: locBreakdown.get(i.id) ?? [],
    }))
    .sort((a, b) => b.gap - a.gap)

  const withoutPar = its.filter((i) => i.par_level == null)

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/owner" className="text-sm text-brand-amber hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Below-par alerts
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Any item where the whole-shop total is at or below its par level.
      </p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}

      <section className="mt-6">
        {below.length === 0 ? (
          <p className="rounded-xl border border-brand-teal/40 bg-brand-teal/5 p-5 text-sm text-brand-teal-deep">
            ✓ Everything above par. Nothing to order right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {below.map((i) => (
              <li
                key={i.id}
                className="rounded-xl border-2 border-brand-amber/60 bg-brand-amber/10 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-forest">
                      {i.name}
                      <span className="ml-1 text-xs text-brand-slate">
                        ({i.unit})
                      </span>
                    </p>
                    {i.supplier_name && (
                      <p className="text-xs text-brand-slate">
                        supplier: {i.supplier_name}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-semibold text-brand-amber">
                      {i.total.toFixed(0)} / {i.par_level}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-brand-slate">
                      short by {i.gap.toFixed(0)}
                    </p>
                  </div>
                </div>
                {i.where.length > 0 && (
                  <p className="mt-2 text-xs text-brand-slate">
                    Currently at:{' '}
                    {i.where
                      .map((w) => `${w.location} (${w.qty.toFixed(0)})`)
                      .join(' · ')}
                  </p>
                )}
                {i.where.length === 0 && (
                  <p className="mt-2 text-xs text-brand-amber">
                    Not stocked anywhere.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Par-level editor */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Set par levels
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          Set a threshold on any item. Leave blank to remove the alert.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-brand-sage/40 px-3 py-2 text-left font-semibold text-brand-slate">
                  Item
                </th>
                <th className="border-b border-brand-sage/40 px-3 py-2 text-right font-semibold text-brand-slate">
                  Total on hand
                </th>
                <th className="border-b border-brand-sage/40 px-3 py-2 text-right font-semibold text-brand-slate">
                  Par
                </th>
                <th className="border-b border-brand-sage/40 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {its.map((i) => (
                <ParRow
                  key={i.id}
                  id={i.id}
                  name={i.name}
                  unit={i.unit}
                  total={totalByItem.get(i.id) ?? 0}
                  par={i.par_level}
                />
              ))}
            </tbody>
          </table>
        </div>

        {withoutPar.length > 0 && (
          <p className="mt-3 text-xs text-brand-slate">
            {withoutPar.length} item{withoutPar.length === 1 ? '' : 's'} without
            a par level — set one to enable alerts.
          </p>
        )}
      </section>
    </main>
  )
}

function ParRow({
  id,
  name,
  unit,
  total,
  par,
}: {
  id: string
  name: string
  unit: string
  total: number
  par: number | null
}) {
  const action = setParLevel.bind(null, id)
  return (
    <tr>
      <td className="border-b border-brand-sage/30 px-3 py-1.5">
        <span className="font-semibold text-brand-forest">{name}</span>
        <span className="ml-1 text-xs text-brand-slate">({unit})</span>
      </td>
      <td className="border-b border-brand-sage/30 px-3 py-1.5 text-right font-mono">
        {total.toFixed(0)}
      </td>
      <td className="border-b border-brand-sage/30 px-3 py-1.5 text-right">
        <form action={action} className="inline-flex items-center gap-2">
          <input
            name="par_level"
            type="number"
            step="0.001"
            min="0"
            defaultValue={par ?? ''}
            className="w-20 rounded-md border border-brand-sage/60 bg-white px-2 py-1 text-right font-mono text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-teal-deep px-2 py-1 text-xs font-semibold text-brand-cream hover:bg-brand-teal"
          >
            Save
          </button>
        </form>
      </td>
      <td className="border-b border-brand-sage/30 px-3 py-1.5" />
    </tr>
  )
}
