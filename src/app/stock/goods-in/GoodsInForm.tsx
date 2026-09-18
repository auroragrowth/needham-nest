'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { receiveNewStock, receiveStock } from '@/lib/stock-locations/actions'

export type GoodsItem = {
  id: string
  name: string
  category: string | null
  unit: string
  /** Where most of it already lives: new stock goes there unless changed. */
  home: string | null
}
export type GoodsLocation = { id: string; name: string; area: string }

const UNITS = ['ea', 'bag', 'box', 'bottle', 'pack', 'tin', 'jar', 'tub', 'kg', 'g', 'L']

const input =
  'w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30'

/**
 * Pick what arrived (type to see matches, or tap a regular), then how many and
 * where it's going. Submits to receiveStock, the same 'receive' move as
 * "Add new stock here" on /stock. Something not in the list can be added on
 * the spot (receiveNewStock), so nobody is stuck waiting for a manager.
 */
export function GoodsInForm({
  items,
  locations,
  regulars,
  fallbackLocation,
  categories,
}: {
  items: GoodsItem[]
  locations: GoodsLocation[]
  /** Existing categories, for a new item. */
  categories: string[]
  /** Item ids shown as fixed buttons: the regular deliveries (bakes). */
  regulars: string[]
  fallbackLocation: string | null
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<GoodsItem | null>(null)
  const [location, setLocation] = useState<string>('')
  /** Adding something that isn't in the list: its name as typed. */
  const [newName, setNewName] = useState<string | null>(null)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const regularItems = regulars.map((id) => byId.get(id)).filter((i): i is GoodsItem => Boolean(i))

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const starts: GoodsItem[] = []
    const contains: GoodsItem[] = []
    for (const i of items) {
      const name = i.name.toLowerCase()
      if (name.startsWith(needle) || name.split(/[\s(]+/).some((w) => w.startsWith(needle))) starts.push(i)
      else if (name.includes(needle) || (i.category ?? '').toLowerCase().includes(needle)) contains.push(i)
    }
    return [...starts, ...contains].slice(0, 8)
  }, [items, query])

  const typed = query.trim()
  const exactMatch = items.some((i) => i.name.toLowerCase() === typed.toLowerCase())

  function choose(item: GoodsItem) {
    setNewName(null)
    setSelected(item)
    setQuery(item.name)
    setOpen(false)
    setLocation(item.home ?? fallbackLocation ?? '')
  }

  function addNew() {
    setSelected(null)
    setNewName(typed)
    setOpen(false)
    setLocation(fallbackLocation ?? '')
  }

  const picking = selected !== null || newName !== null

  const areas = [...new Set(locations.map((l) => l.area))]

  return (
    <div className="mt-5">
      {regularItems.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Regular bakes — tap one
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {regularItems.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => choose(i)}
                className={`rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
                  selected?.id === i.id
                    ? 'border-brand-forest bg-brand-forest text-brand-cream'
                    : 'border-brand-amber/60 bg-brand-amber/10 text-brand-forest hover:bg-brand-amber/20'
                }`}
              >
                {i.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <form
        action={newName !== null ? receiveNewStock : receiveStock}
        className="mt-5 rounded-2xl border border-brand-sage/40 bg-white p-4"
      >
        <input type="hidden" name="back" value="/stock/goods-in" />
        <input type="hidden" name="notes" value="Goods in" />
        <input type="hidden" name="stock_item_id" value={selected?.id ?? ''} />

        <label className="block text-sm font-medium text-brand-forest" htmlFor="goods-search">
          What&apos;s arrived?
        </label>
        <div className="relative mt-1">
          <input
            id="goods-search"
            type="search"
            autoComplete="off"
            value={query}
            placeholder="Start typing, e.g. milk, bacon, cups"
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
              setNewName(null)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !picking && typed) {
                e.preventDefault()
                if (matches[0]) choose(matches[0])
                else addNew()
              }
              if (e.key === 'Escape') setOpen(false)
            }}
            className={`${input} py-3 text-base`}
          />
          {open && !picking && typed && (
            <ul className="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-brand-sage/60 bg-white shadow-lg">
              {matches.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(i)}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-3 text-left hover:bg-brand-teal/10"
                    >
                      <span className="font-medium text-brand-forest">{i.name}</span>
                      <span className="text-xs text-brand-slate">
                        {i.category ?? 'Other'} · {i.unit}
                      </span>
                    </button>
                  </li>
                ))}
              {!exactMatch && (
                <li className="border-t border-brand-sage/30">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={addNew}
                    className="w-full px-3 py-3 text-left font-semibold text-brand-teal-deep hover:bg-brand-teal/10"
                  >
                    ➕ Add &ldquo;{typed}&rdquo; as a new item
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        {newName !== null && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="new_name" value={newName} />
            <p className="rounded-lg bg-brand-teal/10 px-3 py-2 text-sm text-brand-teal-deep sm:col-span-2">
              New item: <b>{newName}</b>. It&apos;s added to the stock list; a manager can tidy the details later.
            </p>
            <label className="text-sm font-medium text-brand-forest">
              Counted in
              <input name="new_unit" list="goods-units" defaultValue="ea" required className={`${input} mt-1`} />
              <datalist id="goods-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>
            <label className="text-sm font-medium text-brand-forest">
              Type of thing
              <select name="new_category" defaultValue="Other" className={`${input} mt-1`}>
                {[...new Set([...categories, 'Other'])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {picking && (
          <div className="mt-4 grid gap-3 sm:grid-cols-[8rem_1fr]">
            <label className="text-sm font-medium text-brand-forest">
              How many{selected ? ` (${selected.unit})` : ''}
              <input
                // Keyed by item, so picking one goes straight to "how many".
                key={selected?.id ?? `new:${newName}`}
                autoFocus
                name="quantity"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                required
                className={`${input} mt-1 text-lg`}
              />
            </label>
            <label className="text-sm font-medium text-brand-forest">
              Where it&apos;s going
              <select
                name="location_id"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className={`${input} mt-1`}
              >
                {areas.map((area) => (
                  <optgroup key={area} label={area}>
                    {locations
                      .filter((l) => l.area === area)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <AddButton name={selected?.name ?? newName ?? ''} />
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

function AddButton({ name }: { name: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive disabled:opacity-60"
    >
      {pending ? 'Adding…' : `Add ${name}`}
    </button>
  )
}
