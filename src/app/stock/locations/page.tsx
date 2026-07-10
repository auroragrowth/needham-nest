import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

type Location = {
  id: string
  name: string
  zone: string
  cold_type: string | null
  sort_order: number
}

const ZONE_LABEL: Record<string, string> = {
  kitchen: 'Kitchen',
  cafe: 'Café',
  storage: 'Storage',
  other: 'Other',
}

const COLD_BADGE: Record<string, string> = {
  chilled: 'bg-brand-teal/20 text-brand-teal-deep',
  frozen: 'bg-blue-100 text-blue-800',
  ambient: 'bg-brand-sage/30 text-brand-forest',
}

export default async function StockLocationsIndex({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const sp = await searchParams

  const admin = createAdminClient()
  const [{ data: locations }, { data: placements }] = await Promise.all([
    admin
      .from('stock_locations')
      .select('id, name, zone, cold_type, sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name'),
    admin.from('stock_placements').select('location_id, quantity'),
  ])

  const totalsByLocation = new Map<string, number>()
  const itemsAtLocation = new Map<string, number>()
  for (const p of placements ?? []) {
    const q = Number(p.quantity)
    totalsByLocation.set(
      p.location_id,
      (totalsByLocation.get(p.location_id) ?? 0) + q,
    )
    if (q > 0) {
      itemsAtLocation.set(
        p.location_id,
        (itemsAtLocation.get(p.location_id) ?? 0) + 1,
      )
    }
  }

  const list = (locations ?? []) as Location[]
  const grouped = new Map<string, Location[]>()
  for (const l of list) {
    const arr = grouped.get(l.zone) ?? []
    arr.push(l)
    grouped.set(l.zone, arr)
  }

  const backHref = session.role === 'owner' ? '/owner' : '/staff'
  const backLabel = session.role === 'owner' ? 'Dashboard' : 'Staff home'

  return (
    <main className="mx-auto max-w-2xl">
      <Link href={backHref} className="text-sm text-brand-amber hover:underline">
        ← {backLabel}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Stock by location
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Tap a location to see what&apos;s in it. From there you can{' '}
        <span className="font-semibold">move</span> stock elsewhere,{' '}
        <span className="font-semibold">adjust</span> for a stock take, or{' '}
        <span className="font-semibold">receive</span> new arrivals.
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

      {['kitchen', 'cafe', 'storage', 'other'].map((zone) => {
        const rows = grouped.get(zone) ?? []
        if (rows.length === 0) return null
        return (
          <section key={zone} className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              {ZONE_LABEL[zone] ?? zone}
            </h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {rows.map((l) => {
                const items = itemsAtLocation.get(l.id) ?? 0
                const total = totalsByLocation.get(l.id) ?? 0
                return (
                  <Link
                    key={l.id}
                    href={`/stock/locations/${l.id}`}
                    className="block rounded-xl border border-brand-sage/40 bg-white p-4 transition hover:border-brand-teal/60 hover:bg-brand-teal/5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-brand-forest">
                        {l.name}
                      </p>
                      {l.cold_type && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            COLD_BADGE[l.cold_type] ?? ''
                          }`}
                        >
                          {l.cold_type}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-brand-slate">
                      {items} item{items === 1 ? '' : 's'} · total qty{' '}
                      <span className="font-mono">{total.toFixed(0)}</span>
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </main>
  )
}
