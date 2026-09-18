import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoodsInForm } from './GoodsInForm'
import { londonParts } from '@/lib/stock/wastage'

/**
 * Goods In: log a delivery as it's put away. Pick what arrived (type for a live
 * dropdown, or tap one of the regular bakes), say how many and where it's going,
 * and it's added to that location (a 'receive' move in stock_location_moves, the
 * same as "Add new stock here" on /stock). Anyone signed in can use it.
 */

type Item = { id: string; name: string; category: string | null; unit: string; regular_delivery: boolean }
type Location = { id: string; name: string; zone: string; sort_order: number }

const AREA: Record<string, string> = { cafe: 'Café', kitchen: 'Kitchen', storage: 'Storage', other: 'Other' }
const AREA_ORDER = ['cafe', 'kitchen', 'storage', 'other']

function qty(n: number): string {
  return Number(n.toFixed(3)).toString()
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' })
}

/** Midnight at the start of today, UK time, as an ISO instant. */
function startOfUkToday(): string {
  const now = new Date()
  const { time: hhmm } = londonParts(now)
  const [h, m] = hhmm.split(':').map(Number)
  const since = new Date(now.getTime() - (h * 60 + m) * 60_000)
  since.setSeconds(0, 0)
  return since.toISOString()
}

export default async function GoodsInPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const session = await getSession()
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: itemRows }, { data: locationRows }, { data: placementRows }, { data: todayRows }, { data: people }] =
    await Promise.all([
      admin.from('stock_items').select('id, name, category, unit, regular_delivery').eq('active', true).order('name'),
      admin.from('stock_locations').select('id, name, zone, sort_order').eq('active', true).order('sort_order'),
      admin.from('stock_placements').select('stock_item_id, location_id, quantity').gt('quantity', 0),
      admin
        .from('stock_location_moves')
        .select('id, quantity, moved_at, moved_by, notes, stock_item_id, to_location_id')
        .eq('kind', 'receive')
        .gte('moved_at', startOfUkToday())
        .order('moved_at', { ascending: false }),
      admin.from('profiles').select('id, name'),
    ])

  const items = (itemRows ?? []) as Item[]
  const locations = ((locationRows ?? []) as Location[]).sort(
    (a, b) => AREA_ORDER.indexOf(a.zone) - AREA_ORDER.indexOf(b.zone) || a.sort_order - b.sort_order,
  )
  const itemById = new Map(items.map((i) => [i.id, i]))
  const locationById = new Map(locations.map((l) => [l.id, l]))
  const nameById = new Map((people ?? []).map((p) => [p.id, p.name]))

  // Where each item usually lives: the location holding most of it. New stock
  // goes there by default; otherwise the first storage location.
  const homeByItem = new Map<string, { location: string; quantity: number }>()
  for (const p of placementRows ?? []) {
    const current = homeByItem.get(p.stock_item_id)
    if (!current || Number(p.quantity) > current.quantity) {
      homeByItem.set(p.stock_item_id, { location: p.location_id, quantity: Number(p.quantity) })
    }
  }
  const fallback = locations.find((l) => l.zone === 'storage') ?? locations[0]

  const home = session?.role === 'owner' ? '/owner' : session?.role === 'staff' ? '/staff' : '/manager'

  return (
    <main className="mx-auto max-w-3xl">
      <Link href={home} className="text-sm text-brand-amber hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">📥 Goods In</h1>
      <p className="mt-1 text-sm text-brand-slate">
        A delivery or shopping trip: pick each item, say how many came and where it&apos;s going.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          ✓ {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <GoodsInForm
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          unit: i.unit,
          home: homeByItem.get(i.id)?.location ?? null,
        }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name, area: AREA[l.zone] ?? 'Other' }))}
        regulars={items.filter((i) => i.regular_delivery).map((i) => i.id)}
        fallbackLocation={fallback?.id ?? null}
        categories={[...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort()}
      />

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">Goods in today</h2>
        {(todayRows ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-brand-slate">Nothing booked in yet today.</p>
        ) : (
          <ul className="mt-2 divide-y divide-brand-sage/30 rounded-xl border border-brand-sage/40 bg-white text-sm">
            {(todayRows ?? []).map((r) => {
              const item = itemById.get(r.stock_item_id)
              const place = r.to_location_id ? locationById.get(r.to_location_id) : undefined
              return (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                  <span className="text-brand-forest">
                    <b>{qty(Number(r.quantity))}</b> {item?.unit} {item?.name ?? 'Unknown item'}
                    <span className="text-brand-slate"> → {place?.name ?? 'unknown place'}</span>
                  </span>
                  <span className="text-xs text-brand-slate">
                    {time(r.moved_at)} · {r.moved_by ? (nameById.get(r.moved_by) ?? 'Unknown') : '—'}
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
