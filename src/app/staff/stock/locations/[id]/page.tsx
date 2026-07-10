import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  moveStock,
  adjustPlacement,
  receiveStock,
} from '@/lib/stock-locations/actions'

export const dynamic = 'force-dynamic'

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const { id } = await params
  const sp = await searchParams

  const admin = createAdminClient()
  const { data: location } = await admin
    .from('stock_locations')
    .select('id, name, zone, cold_type')
    .eq('id', id)
    .maybeSingle()
  if (!location) notFound()

  const [{ data: placements }, { data: allItems }, { data: allLocations }] =
    await Promise.all([
      admin
        .from('stock_placements')
        .select(
          'id, quantity, stock_item_id, stock_items:stock_item_id(id, name, unit, par_level)',
        )
        .eq('location_id', id),
      admin
        .from('stock_items')
        .select('id, name, unit, par_level')
        .eq('active', true)
        .order('name'),
      admin
        .from('stock_locations')
        .select('id, name')
        .eq('active', true)
        .neq('id', id)
        .order('sort_order')
        .order('name'),
    ])

  type Row = {
    id: string
    quantity: number
    stock_item_id: string
    stock_items: { id: string; name: string; unit: string; par_level: number | null } | null
  }
  const rows = ((placements ?? []) as unknown as Row[])
    .filter((p) => p.stock_items)
    .sort((a, b) =>
      (a.stock_items!.name ?? '').localeCompare(b.stock_items!.name ?? ''),
    )

  const back = `/staff/stock/locations/${id}`

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/staff/stock/locations"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All locations
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {location.name}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {location.zone} {location.cold_type ? `· ${location.cold_type}` : ''}
      </p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/60 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      {/* CURRENT CONTENTS */}
      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Currently here
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
            Nothing recorded here yet. Use the actions below to add stock.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-brand-sage/40 bg-white p-3"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-brand-forest">
                    {r.stock_items!.name}
                    <span className="ml-1 text-xs text-brand-slate">
                      ({r.stock_items!.unit})
                    </span>
                  </p>
                  <p className="font-mono text-lg font-semibold text-brand-forest">
                    {Number(r.quantity).toFixed(0)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* MOVE */}
      <section className="mt-8 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-forest">
          ➡️ Move stock out of {location.name}
        </h2>
        <form action={moveStock} className="mt-3 space-y-3">
          <input type="hidden" name="from_location_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Item
            </label>
            <select
              name="stock_item_id"
              required
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            >
              <option value="">— pick an item —</option>
              {rows.map((r) => (
                <option key={r.id} value={r.stock_item_id}>
                  {r.stock_items!.name} (here: {Number(r.quantity).toFixed(0)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Move to
            </label>
            <select
              name="to_location_id"
              required
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            >
              <option value="">— pick a destination —</option>
              {(allLocations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Quantity
            </label>
            <input
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              required
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-brand-cream hover:bg-brand-olive"
          >
            Move
          </button>
        </form>
      </section>

      {/* RECEIVE */}
      <section className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-forest">
          📥 Receive new stock into {location.name}
        </h2>
        <form action={receiveStock} className="mt-3 space-y-3">
          <input type="hidden" name="location_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Item
            </label>
            <select
              name="stock_item_id"
              required
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            >
              <option value="">— pick an item —</option>
              {(allItems ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Quantity in
            </label>
            <input
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              required
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-teal-deep px-4 py-2 text-sm font-semibold text-brand-cream hover:bg-brand-teal"
          >
            Add to location
          </button>
        </form>
      </section>

      {/* ADJUST */}
      <section className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-forest">
          ✏️ Adjust count (stock take)
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          Sets the count at this location to whatever you type — use this after
          a physical count.
        </p>
        <form action={adjustPlacement} className="mt-3 space-y-3">
          <input type="hidden" name="location_id" value={id} />
          <input type="hidden" name="back" value={back} />
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Item
            </label>
            <select
              name="stock_item_id"
              required
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            >
              <option value="">— pick an item —</option>
              {(allItems ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Set count to
            </label>
            <input
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              required
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
          >
            Save count
          </button>
        </form>
      </section>
    </main>
  )
}
