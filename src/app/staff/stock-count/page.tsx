import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { recordStockCount } from '@/lib/stock/actions'

export default async function StockCountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  await requireStaffFeature('stock_count')
  const params = await searchParams
  const admin = createAdminClient()
  const { data: items } = await admin
    .from('stock_items')
    .select('id, name, category, unit, par_level')
    .eq('active', true)
    .order('category')
    .order('name')

  // Group by category for clarity
  const grouped = new Map<string, typeof items>()
  for (const it of items ?? []) {
    const k = it.category ?? '—'
    const arr = (grouped.get(k) ?? []) as typeof items
    arr!.push(it)
    grouped.set(k, arr)
  }

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Stock count
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Enter the current amount you can see for each item. Leave items blank
        if you&apos;re not counting them now.
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

      {(items?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          No stock items configured yet.
        </p>
      ) : (
        <form action={recordStockCount} className="mt-6 space-y-6">
          {Array.from(grouped.entries()).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                {cat}
              </h2>
              <ul className="mt-2 space-y-2">
                {list!.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 rounded-xl border border-brand-sage/40 bg-white p-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-brand-forest">
                        {it.name}
                      </p>
                      <p className="text-xs text-brand-slate">
                        per {it.unit}
                        {it.par_level != null && ` · par ${it.par_level}`}
                      </p>
                    </div>
                    <input
                      name={`count_${it.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0"
                      className="w-24 rounded-md border border-brand-sage/60 bg-white px-2 py-2 text-right text-lg text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-brand-forest"
            >
              Notes (optional)
            </label>
            <input
              id="notes"
              name="notes"
              type="text"
              placeholder="e.g. weekly count"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-brand-forest px-6 py-4 text-lg font-semibold text-brand-cream hover:bg-brand-olive"
          >
            Save counts
          </button>
        </form>
      )}
    </main>
  )
}
