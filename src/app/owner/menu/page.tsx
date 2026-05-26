import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeRecipeCost,
  gpPercent,
  type RecipeLine,
  type StockCostInfo,
} from '@/lib/menu'

export default async function MenuListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: items }, { data: stock }] = await Promise.all([
    admin
      .from('menu_items')
      .select('id, name, category, sell_price, cost_price_override, recipe, allergens, active')
      .order('active', { ascending: false })
      .order('category')
      .order('name'),
    admin
      .from('stock_items')
      .select('id, name, unit, cost_price'),
  ])

  const stockById = new Map<string, StockCostInfo>(
    (stock ?? []).map((s) => [
      s.id,
      { id: s.id, name: s.name, unit: s.unit, cost_price: s.cost_price },
    ]),
  )

  const groups = new Map<string, typeof items>()
  for (const it of items ?? []) {
    const k = it.category ?? '—'
    const arr = (groups.get(k) ?? []) as typeof items
    arr!.push(it)
    groups.set(k, arr)
  }

  return (
    <main className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Menu items
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Each item has a recipe linked to stock. Cost auto-computes from
            ingredients unless you override it.
          </p>
        </div>
        <Link
          href="/owner/menu/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add item
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      {(items?.length ?? 0) === 0 && (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          No menu items yet.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {Array.from(groups.entries()).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              {cat}
            </h2>
            <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3 text-right">Sell £</th>
                    <th className="px-4 py-3 text-right">Cost £</th>
                    <th className="px-4 py-3 text-right">GP%</th>
                    <th className="px-4 py-3">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list!.map((it) => {
                    const recipe = (it.recipe ?? []) as RecipeLine[]
                    const cost =
                      it.cost_price_override != null
                        ? Number(it.cost_price_override)
                        : computeRecipeCost(recipe, stockById)
                    const gp = gpPercent(Number(it.sell_price), cost)
                    return (
                      <tr
                        key={it.id}
                        className={`border-t border-brand-sage/30 ${
                          it.active ? '' : 'text-brand-slate'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-brand-forest">
                          {it.name}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          £{Number(it.sell_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          £{cost.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono ${
                            gp >= 65
                              ? 'text-brand-teal-deep'
                              : gp >= 50
                                ? 'text-brand-forest'
                                : 'text-brand-amber'
                          }`}
                        >
                          {gp.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {it.active ? (
                            <span className="text-brand-teal-deep">Active</span>
                          ) : (
                            <span className="text-brand-slate">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/owner/menu/${it.id}`}
                            className="text-sm font-medium text-brand-amber hover:underline"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
