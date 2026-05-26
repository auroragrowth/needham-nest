import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deactivateMenuItem,
  reactivateMenuItem,
  updateMenuItem,
} from '@/lib/menu/actions'
import {
  computeRecipeCost,
  gpPercent,
  type RecipeLine,
  type StockCostInfo,
} from '@/lib/menu'
import { MenuItemForm } from '../form'

export default async function EditMenuItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()

  const [{ data: item }, { data: stock }] = await Promise.all([
    admin
      .from('menu_items')
      .select('id, name, category, description, sell_price, cost_price_override, recipe, allergens, active')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('stock_items')
      .select('id, name, unit, cost_price')
      .order('name'),
  ])

  if (!item) notFound()

  const stockOptions = (stock ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    unit: s.unit,
  }))
  const stockById = new Map<string, StockCostInfo>(
    (stock ?? []).map((s) => [
      s.id,
      { id: s.id, name: s.name, unit: s.unit, cost_price: s.cost_price },
    ]),
  )

  const recipe = (item.recipe ?? []) as RecipeLine[]
  const recipeCost = computeRecipeCost(recipe, stockById)
  const effectiveCost =
    item.cost_price_override != null
      ? Number(item.cost_price_override)
      : recipeCost
  const gp = gpPercent(Number(item.sell_price), effectiveCost)

  const action = updateMenuItem.bind(null, id)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/menu"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Menu
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {item.name}
      </h1>
      <div className="mt-1 flex flex-wrap items-baseline gap-3 text-sm text-brand-slate">
        <span>{item.category ?? '—'}</span>
        <span>·</span>
        <span>Sell £{Number(item.sell_price).toFixed(2)}</span>
        <span>·</span>
        <span>
          Cost £{effectiveCost.toFixed(2)}
          {item.cost_price_override != null && ' (override)'}
        </span>
        <span>·</span>
        <span
          className={
            gp >= 65
              ? 'text-brand-teal-deep'
              : gp >= 50
                ? 'text-brand-forest'
                : 'text-brand-amber'
          }
        >
          GP {gp.toFixed(1)}%
        </span>
      </div>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <MenuItemForm
        action={action}
        stockOptions={stockOptions}
        defaults={{
          name: item.name,
          category: item.category,
          description: item.description,
          sell_price: Number(item.sell_price),
          cost_price_override:
            item.cost_price_override != null
              ? Number(item.cost_price_override)
              : null,
          recipe,
          allergens: item.allergens ?? [],
        }}
        submitLabel="Save changes"
      />

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          {item.active ? 'Deactivate' : 'Reactivate'}
        </h2>
        <form
          action={
            item.active
              ? deactivateMenuItem.bind(null, id)
              : reactivateMenuItem.bind(null, id)
          }
          className="mt-3"
        >
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              item.active
                ? 'border border-brand-amber/60 bg-brand-amber/10 text-brand-forest hover:bg-brand-amber/20'
                : 'bg-brand-teal-deep text-brand-cream hover:bg-brand-teal'
            }`}
          >
            {item.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </form>
      </section>
    </main>
  )
}
