'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { wasteNewItem } from '@/lib/stock/actions'

export type WasteItem = { id: string; name: string; category: string | null; unit: string }

const UNITS = ['ea', 'bag', 'box', 'bottle', 'pack', 'tin', 'jar', 'tub', 'kg', 'g', 'L']

const input =
  'w-full rounded-xl border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30'

/**
 * Find what's being thrown away: matches appear as you type and go to that
 * item's waste form. Something not in the list can be added on the spot
 * (wasteNewItem), which then opens its waste form.
 */
export function WastePicker({ items }: { items: WasteItem[] }) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const typed = query.trim()

  const matches = useMemo(() => {
    const needle = typed.toLowerCase()
    if (!needle) return []
    const starts: WasteItem[] = []
    const contains: WasteItem[] = []
    for (const i of items) {
      const name = i.name.toLowerCase()
      if (name.startsWith(needle) || name.split(/[\s(]+/).some((w) => w.startsWith(needle))) starts.push(i)
      else if (name.includes(needle) || (i.category ?? '').toLowerCase().includes(needle)) contains.push(i)
    }
    return [...starts, ...contains].slice(0, 8)
  }, [items, typed])

  const exactMatch = items.some((i) => i.name.toLowerCase() === typed.toLowerCase())

  return (
    <div className="mt-6">
      <label htmlFor="waste-search" className="block text-sm font-medium text-brand-forest">
        What&apos;s being thrown away?
      </label>
      <input
        id="waste-search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAdding(false)
        }}
        placeholder="Start typing, e.g. sausage roll, milk"
        className={`${input} mt-1`}
      />

      {typed && !adding && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-brand-sage/60 bg-white">
          {matches.map((i) => (
            <li key={i.id} className="border-b border-brand-sage/20 last:border-b-0">
              <Link
                href={`/staff/wastage/${i.id}`}
                className="flex items-baseline justify-between gap-2 px-3 py-3 hover:bg-brand-teal/10"
              >
                <span className="font-medium text-brand-forest">{i.name}</span>
                <span className="text-xs text-brand-slate">
                  {i.category ?? 'Other'} · {i.unit}
                </span>
              </Link>
            </li>
          ))}
          {!exactMatch && (
            <li>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full px-3 py-3 text-left font-semibold text-brand-teal-deep hover:bg-brand-teal/10"
              >
                ➕ Log waste for &ldquo;{typed}&rdquo; (new item)
              </button>
            </li>
          )}
        </ul>
      )}

      {adding && (
        <form action={wasteNewItem} className="mt-2 rounded-xl border border-brand-teal/40 bg-brand-teal/5 p-3">
          <input type="hidden" name="new_name" value={typed} />
          <p className="text-sm text-brand-forest">
            New item: <b>{typed}</b>. It&apos;s added to the stock list, then you log the waste.
          </p>
          <label className="mt-2 block text-sm font-medium text-brand-forest">
            Counted in
            <input name="new_unit" list="waste-units" defaultValue="ea" required className={`${input} mt-1 py-2`} />
            <datalist id="waste-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-brand-forest px-4 py-3 text-sm font-semibold text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive"
          >
            Next: log the waste
          </button>
        </form>
      )}
    </div>
  )
}
