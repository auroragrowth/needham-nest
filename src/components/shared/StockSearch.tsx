'use client'

import { useEffect, useRef, useState } from 'react'

type LocationBreakdown = { name: string; quantity: number }
type ItemResult = {
  id: string
  name: string
  unit: string
  total: number
  locations: LocationBreakdown[]
}

/** Trim trailing zeros: 7.000 → "7", 2.500 → "2.5". */
function fmtQty(n: number) {
  return Number(n.toFixed(3)).toString()
}

export function StockSearch() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ItemResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced fetch whenever the query changes.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/stock/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        )
        if (!res.ok) throw new Error('search failed')
        const data = (await res.json()) as { items: ItemResult[] }
        setItems(data.items ?? [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setItems([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Close the results panel on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const q = query.trim()
  const showPanel = open && q.length >= 2

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search stock — type an item name…"
        aria-label="Search stock by item name"
        className="w-full rounded-lg border border-brand-sage/40 bg-white px-3 py-1.5 text-sm text-brand-forest placeholder:text-brand-slate/60 focus:border-brand-amber focus:outline-none focus:ring-2 focus:ring-brand-amber/40"
      />

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-xl border border-brand-sage/40 bg-white shadow-lg">
          {loading && items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-brand-slate">Searching…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-brand-slate">
              No items match “{q}”.
            </p>
          ) : (
            <ul className="divide-y divide-brand-sage/20">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-brand-forest">
                      {item.name}
                    </span>
                    <span className="whitespace-nowrap text-xs text-brand-slate">
                      {fmtQty(item.total)} {item.unit} total
                    </span>
                  </div>
                  {item.locations.length === 0 ? (
                    <p className="mt-1 text-sm text-brand-slate">
                      Not in any location yet.
                    </p>
                  ) : (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.locations.map((loc) => (
                        <li
                          key={loc.name}
                          className="rounded-md bg-brand-cream px-2 py-0.5 text-sm text-brand-forest"
                        >
                          {loc.name}{' '}
                          <span className="font-mono font-semibold">
                            {fmtQty(loc.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
