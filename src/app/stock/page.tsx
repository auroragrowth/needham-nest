import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canControlStock } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createItem, deactivateItem, updateItem } from '@/lib/stock/actions'
import {
  createLocation,
  deactivateLocation,
  moveStock,
  receiveStock,
  saveLocationCounts,
} from '@/lib/stock-locations/actions'

/**
 * Stock: one record of what we've got and where.
 *
 * stock_placements (item × location × quantity) is the only place stock is
 * kept. Overall adds it up per item; Café, Kitchen and Storage show each area's
 * fridges, freezers and shelves, where the stock take, moves and new stock
 * happen. Everyone signed in can do those; managers also edit items and
 * locations.
 */

const TABS = [
  { key: 'overall', label: 'Overall' },
  { key: 'cafe', label: 'Café' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'storage', label: 'Storage' },
] as const
type Tab = (typeof TABS)[number]['key']

const AREA: Record<string, string> = { cafe: 'Café', kitchen: 'Kitchen', storage: 'Storage', other: 'Other' }
const KIND: Record<string, string> = { chilled: 'Fridge', frozen: 'Freezer', ambient: 'Shelves' }
const AREA_ORDER = ['cafe', 'kitchen', 'storage', 'other']

/** till_item_id: sold on the till, which names it and receives its stock takes. */
type Item = {
  id: string
  name: string
  category: string | null
  unit: string
  till_item_id: string | null
  /** Till servings in one counted unit, e.g. drinks per post-mix bag-in-box. Null means 1. */
  till_servings_per_unit: number | null
}
type Location = { id: string; name: string; zone: string; cold_type: string | null; sort_order: number }
type Placement = { stock_item_id: string; location_id: string; quantity: number; updated_at: string }

const input =
  'mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30'
const button =
  'rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive'

function qty(n: number): string {
  return Number(n.toFixed(3)).toString()
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' })
}

function byCategory<T extends { item: Item }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.item.category ?? 'Other'
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.entries()]
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; loc?: string; q?: string; notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const [{ data: itemRows }, { data: locationRows }, { data: placementRows }, manager] = await Promise.all([
    admin.from('stock_items').select('id, name, category, unit, till_item_id, till_servings_per_unit').eq('active', true).order('category').order('name'),
    admin
      .from('stock_locations')
      .select('id, name, zone, cold_type, sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name'),
    admin.from('stock_placements').select('stock_item_id, location_id, quantity, updated_at'),
    canControlStock(session),
  ])

  const items = (itemRows ?? []) as Item[]
  const locations = ((locationRows ?? []) as Location[]).sort(
    (a, b) => AREA_ORDER.indexOf(a.zone) - AREA_ORDER.indexOf(b.zone) || a.sort_order - b.sort_order,
  )
  const itemById = new Map(items.map((i) => [i.id, i]))
  const locationById = new Map(locations.map((l) => [l.id, l]))
  // Only stock in active items at active locations counts.
  const placements = ((placementRows ?? []) as Placement[])
    .map((p) => ({ ...p, quantity: Number(p.quantity) }))
    .filter((p) => itemById.has(p.stock_item_id) && locationById.has(p.location_id))

  const selected = params.loc ? locationById.get(params.loc) ?? null : null
  const tab: Tab = selected
    ? ((TABS.find((t) => t.key === selected.zone)?.key ?? 'overall') as Tab)
    : ((TABS.find((t) => t.key === params.tab)?.key ?? 'overall') as Tab)

  const home = session.role === 'owner' ? '/owner' : session.role === 'staff' ? '/staff' : '/manager'

  return (
    <main className="mx-auto max-w-3xl">
      <Link href={home} className="text-sm text-brand-amber hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">Stock</h1>
      <p className="mt-1 text-sm text-brand-slate">
        What we&apos;ve got, and where it is.{' '}
        <Link href="/stock/goods-in" className="font-medium text-brand-amber hover:underline">
          📥 Goods In — book in a delivery →
        </Link>
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <nav className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-brand-sage/40 bg-white p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/stock?tab=${t.key}`}
            className={`rounded-xl px-2 py-3 text-center text-sm font-semibold transition ${
              t.key === tab ? 'bg-brand-forest text-brand-cream' : 'text-brand-forest hover:bg-brand-sage/15'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'overall' ? (
        <Overall items={items} locationById={locationById} placements={placements} q={params.q ?? ''} manager={manager} />
      ) : selected ? (
        <LocationView
          location={selected}
          locations={locations}
          items={items}
          placements={placements}
        />
      ) : (
        <Area zone={tab} locations={locations} placements={placements} manager={manager} />
      )}
    </main>
  )
}

function Overall({
  items,
  locationById,
  placements,
  q,
  manager,
}: {
  items: Item[]
  locationById: Map<string, Location>
  placements: Placement[]
  q: string
  manager: boolean
}) {
  const where = new Map<string, { location: Location; quantity: number }[]>()
  for (const p of placements) {
    if (p.quantity <= 0) continue
    where.set(p.stock_item_id, [...(where.get(p.stock_item_id) ?? []), { location: locationById.get(p.location_id)!, quantity: p.quantity }])
  }
  const search = q.trim().toLowerCase()
  const rows = items
    .filter((item) => !search || item.name.toLowerCase().includes(search) || (item.category ?? '').toLowerCase().includes(search))
    .map((item) => {
      const spots = (where.get(item.id) ?? []).sort(
        (a, b) =>
          AREA_ORDER.indexOf(a.location.zone) - AREA_ORDER.indexOf(b.location.zone) ||
          a.location.sort_order - b.location.sort_order,
      )
      return { item, spots, total: spots.reduce((sum, s) => sum + s.quantity, 0) }
    })
  const counted = rows.filter((r) => r.total > 0).length
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[]
  const units = [...new Set(items.map((i) => i.unit))]

  return (
    <section className="mt-5">
      <form className="flex gap-2">
        <input type="hidden" name="tab" value="overall" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Find an item…"
          aria-label="Find an item"
          className="w-full rounded-lg border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal"
        />
        <button type="submit" className={button}>
          Find
        </button>
      </form>
      <p className="mt-2 text-xs text-brand-slate">
        {rows.length} item{rows.length === 1 ? '' : 's'} · {counted} with stock counted. Tap an item to see where it is.
      </p>

      <datalist id="stock-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="stock-units">
        {units.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {manager && (
        <details className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-4">
          <summary className="cursor-pointer font-semibold text-brand-forest">＋ Add an item</summary>
          <form action={createItem} className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-brand-forest sm:col-span-3">
              Name
              <input name="name" required className={input} placeholder="e.g. Pulled pork (bag)" />
            </label>
            <label className="text-sm text-brand-forest">
              Category
              <input name="category" list="stock-categories" className={input} />
            </label>
            <label className="text-sm text-brand-forest">
              Counted in
              <input name="unit" list="stock-units" defaultValue="ea" className={input} />
            </label>
            <div className="flex items-end">
              <button type="submit" className={button}>
                Add item
              </button>
            </div>
          </form>
        </details>
      )}

      {byCategory(rows).map(([category, group]) => (
        <div key={category} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">{category}</h2>
          <ul className="mt-2 space-y-2">
            {group.map(({ item, spots, total }) => (
              <li key={item.id}>
                <details className="rounded-xl border border-brand-sage/40 bg-white">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
                    <span className="font-medium text-brand-forest">{item.name}</span>
                    <span className={`text-sm ${total > 0 ? 'font-semibold text-brand-forest' : 'text-brand-slate'}`}>
                      {total > 0 ? `${qty(total)} ${item.unit}` : 'none counted'}
                      {total > 0 && item.till_servings_per_unit
                        ? ` · ${Math.floor(total * Number(item.till_servings_per_unit))} servings`
                        : ''}
                    </span>
                  </summary>
                  <div className="border-t border-brand-sage/30 p-3">
                    {spots.length === 0 ? (
                      <p className="text-sm text-brand-slate">Not counted anywhere yet.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {spots.map(({ location, quantity }) => (
                          <li key={location.id}>
                            <Link
                              href={`/stock?loc=${location.id}`}
                              className="block rounded-lg bg-brand-cream px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/20"
                            >
                              {AREA[location.zone] ?? location.zone} · {location.name} ·{' '}
                              <span className="font-semibold">{qty(quantity)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {manager && item.till_item_id && (
                      <div className="mt-4 border-t border-brand-sage/30 pt-3">
                        <p className="text-xs text-brand-slate">
                          Sold on the till, which names it and gets its stock takes. Change the name there.
                        </p>
                        <form action={updateItem.bind(null, item.id)} className="mt-3 grid gap-3 sm:grid-cols-3">
                          <label className="text-sm text-brand-forest">
                            Counted in
                            <input name="unit" list="stock-units" defaultValue={item.unit} className={input} />
                          </label>
                          <label className="text-sm text-brand-forest">
                            Till servings in each
                            <input
                              name="till_servings_per_unit"
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={0}
                              defaultValue={item.till_servings_per_unit ?? ''}
                              placeholder="1"
                              className={input}
                            />
                          </label>
                          <div className="flex items-end">
                            <button type="submit" className={button}>
                              Save
                            </button>
                          </div>
                          <p className="text-xs text-brand-slate sm:col-span-3">
                            E.g. counted in BIB with 92 servings each: 2 BIBs tells the till 184. Blank means 1 each.
                          </p>
                        </form>
                      </div>
                    )}
                    {manager && !item.till_item_id && (
                      <div className="mt-4 border-t border-brand-sage/30 pt-3">
                        <form action={updateItem.bind(null, item.id)} className="grid gap-3 sm:grid-cols-3">
                          <label className="text-sm text-brand-forest sm:col-span-3">
                            Name
                            <input name="name" required defaultValue={item.name} className={input} />
                          </label>
                          <label className="text-sm text-brand-forest">
                            Category
                            <input name="category" list="stock-categories" defaultValue={item.category ?? ''} className={input} />
                          </label>
                          <label className="text-sm text-brand-forest">
                            Counted in
                            <input name="unit" list="stock-units" defaultValue={item.unit} className={input} />
                          </label>
                          <div className="flex items-end">
                            <button type="submit" className={button}>
                              Save
                            </button>
                          </div>
                        </form>
                        <form action={deactivateItem.bind(null, item.id)} className="mt-2">
                          <button type="submit" className="text-xs font-medium text-brand-amber hover:underline">
                            Remove this item (its history is kept)
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function Area({
  zone,
  locations,
  placements,
  manager,
}: {
  zone: string
  locations: Location[]
  placements: Placement[]
  manager: boolean
}) {
  const here = locations.filter((l) => l.zone === zone)
  return (
    <section className="mt-5">
      {here.length === 0 ? (
        <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          No locations in {AREA[zone]} yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {here.map((location) => {
            const stock = placements.filter((p) => p.location_id === location.id)
            const withStock = stock.filter((p) => p.quantity > 0).length
            const last = stock.reduce<string | null>((max, p) => (!max || p.updated_at > max ? p.updated_at : max), null)
            return (
              <li key={location.id}>
                <Link
                  href={`/stock?loc=${location.id}`}
                  className="block h-full rounded-2xl border border-brand-sage/40 bg-white p-4 transition hover:border-brand-teal/60 hover:bg-brand-teal/5"
                >
                  <p className="font-semibold text-brand-forest">{location.name}</p>
                  <p className="mt-0.5 text-xs text-brand-slate">{KIND[location.cold_type ?? ''] ?? 'Storage'}</p>
                  <p className="mt-3 text-sm text-brand-forest">
                    {withStock} item{withStock === 1 ? '' : 's'} in stock
                  </p>
                  <p className="text-xs text-brand-slate">{last ? `Last changed ${day(last)}` : 'Not counted yet'}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {manager && (
        <details className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-forest">Manage {AREA[zone]} locations</summary>
          <form action={createLocation} className="mt-3 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="zone" value={zone} />
            <label className="text-sm text-brand-forest sm:col-span-2">
              New location
              <input name="name" required className={input} placeholder="e.g. Kitchen chest freezer" />
            </label>
            <label className="text-sm text-brand-forest">
              Type
              <select name="cold_type" defaultValue="chilled" className={input}>
                <option value="chilled">Fridge</option>
                <option value="frozen">Freezer</option>
                <option value="ambient">Shelves</option>
              </select>
            </label>
            <div>
              <button type="submit" className={button}>
                Add location
              </button>
            </div>
          </form>
          {here.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-brand-sage/30 pt-3">
              {here.map((location) => (
                <li key={location.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-brand-forest">{location.name}</span>
                  <form action={deactivateLocation.bind(null, location.id)}>
                    <button type="submit" className="text-xs font-medium text-brand-amber hover:underline">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </section>
  )
}

function LocationView({
  location,
  locations,
  items,
  placements,
}: {
  location: Location
  locations: Location[]
  items: Item[]
  placements: Placement[]
}) {
  const itemById = new Map(items.map((i) => [i.id, i]))
  const back = `/stock?loc=${location.id}`
  const rows = placements
    .filter((p) => p.location_id === location.id)
    .map((p) => ({ item: itemById.get(p.stock_item_id)!, quantity: p.quantity }))
    .sort((a, b) => (a.item.category ?? '').localeCompare(b.item.category ?? '') || a.item.name.localeCompare(b.item.name))
  const keptHere = new Set(rows.map((r) => r.item.id))
  const others = items.filter((i) => !keptHere.has(i.id))
  const inStock = rows.filter((r) => r.quantity > 0)
  const siblings = locations.filter((l) => l.zone === location.zone)
  const elsewhere = locations.filter((l) => l.id !== location.id)

  return (
    <section className="mt-5">
      <div className="flex flex-wrap gap-2">
        {siblings.map((l) => (
          <Link
            key={l.id}
            href={`/stock?loc=${l.id}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              l.id === location.id
                ? 'border-brand-forest bg-brand-forest/10 font-semibold text-brand-forest'
                : 'border-brand-sage/60 text-brand-forest hover:bg-brand-sage/15'
            }`}
          >
            {l.name}
          </Link>
        ))}
      </div>

      <h2 className="mt-4 text-lg font-semibold text-brand-forest">{location.name}</h2>
      <p className="text-xs text-brand-slate">
        {AREA[location.zone]} · {KIND[location.cold_type ?? ''] ?? 'Storage'}
      </p>

      <form action={saveLocationCounts} className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-4">
        <input type="hidden" name="location_id" value={location.id} />
        <input type="hidden" name="back" value={back} />
        <p className="font-semibold text-brand-forest">Stock take</p>
        <p className="text-xs text-brand-slate">
          Put what&apos;s actually here in each box, then Save. 0 means none; leave a box blank to skip it.
          Till items start blank — the till sells them, so count what&apos;s really there.
        </p>

        {rows.length === 0 && <p className="mt-3 text-sm text-brand-slate">Nothing is kept here yet — add an item below.</p>}

        {byCategory(rows).map(([category, group]) => (
          <div key={category} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">{category}</p>
            <ul className="mt-1 divide-y divide-brand-sage/20">
              {group.map(({ item, quantity }) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <label htmlFor={`count_${item.id}`} className="text-sm text-brand-forest">
                    {item.name}
                    {item.till_item_id && (
                      <span className="ml-2 rounded bg-brand-teal/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-teal-deep">
                        till
                      </span>
                    )}
                    {item.till_servings_per_unit && (
                      <span className="block text-xs text-brand-slate">
                        {qty(Number(item.till_servings_per_unit))} servings per {item.unit}
                      </span>
                    )}
                  </label>
                  <span className="flex items-center gap-2">
                    <input
                      id={`count_${item.id}`}
                      name={`count_${item.id}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      defaultValue={item.till_item_id ? undefined : qty(quantity)}
                      placeholder={item.till_item_id ? `was ${qty(quantity)}` : undefined}
                      className="w-24 rounded-md border border-brand-sage/60 bg-white px-2 py-1.5 text-right text-brand-forest"
                    />
                    <span className="w-10 text-xs text-brand-slate">{item.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {others.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-brand-sage/30 pt-3 sm:grid-cols-[1fr_7rem]">
            <label className="text-sm text-brand-forest">
              Add an item that&apos;s here
              <select name="new_item_id" defaultValue="" className={input}>
                <option value="">—</option>
                {others.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-brand-forest">
              Count
              <input name="new_item_count" type="number" inputMode="decimal" step="any" min={0} className={input} />
            </label>
          </div>
        )}

        <button type="submit" className={`mt-4 w-full ${button} py-3 text-base`}>
          Save counts
        </button>
      </form>

      <details className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-brand-forest">Move stock from here</summary>
        {inStock.length === 0 ? (
          <p className="mt-3 text-sm text-brand-slate">Nothing counted here to move.</p>
        ) : (
          <form action={moveStock} className="mt-3 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="from_location_id" value={location.id} />
            <input type="hidden" name="back" value={back} />
            <label className="text-sm text-brand-forest">
              Item
              <select name="stock_item_id" required defaultValue="" className={input}>
                <option value="" disabled>
                  Pick…
                </option>
                {inStock.map(({ item, quantity }) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({qty(quantity)} here)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-brand-forest">
              To
              <select name="to_location_id" required defaultValue="" className={input}>
                <option value="" disabled>
                  Pick…
                </option>
                {AREA_ORDER.map((zone) => {
                  const inZone = elsewhere.filter((l) => l.zone === zone)
                  return inZone.length === 0 ? null : (
                    <optgroup key={zone} label={AREA[zone]}>
                      {inZone.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </label>
            <label className="text-sm text-brand-forest">
              How many
              <input name="quantity" type="number" inputMode="decimal" step="any" min={0} required className={input} />
            </label>
            <div className="sm:col-span-3">
              <button type="submit" className={button}>
                Move
              </button>
            </div>
          </form>
        )}
      </details>

      <details className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-brand-forest">Add new stock here</summary>
        <p className="mt-1 text-xs text-brand-slate">For a delivery or shopping arriving — adds to what&apos;s already counted.</p>
        <form action={receiveStock} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="location_id" value={location.id} />
          <input type="hidden" name="back" value={back} />
          <label className="text-sm text-brand-forest sm:col-span-2">
            Item
            <select name="stock_item_id" required defaultValue="" className={input}>
              <option value="" disabled>
                Pick…
              </option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-brand-forest">
            How many
            <input name="quantity" type="number" inputMode="decimal" step="any" min={0} required className={input} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className={button}>
              Add stock
            </button>
          </div>
        </form>
      </details>
    </section>
  )
}
