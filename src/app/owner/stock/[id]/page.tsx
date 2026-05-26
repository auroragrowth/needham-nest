import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deactivateItem,
  reactivateItem,
  updateItem,
} from '@/lib/stock/actions'
import { StockForm } from '../form'

export default async function EditStockItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: it } = await admin
    .from('stock_items')
    .select('id, sku, name, category, unit, par_level, reorder_at, cost_price, supplier_name, active')
    .eq('id', id)
    .maybeSingle()
  if (!it) notFound()

  const action = updateItem.bind(null, id)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/stock"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Stock items
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {it.name}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {it.active ? 'Active' : 'Inactive'}
        {it.category ? ` · ${it.category}` : ''}
      </p>

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

      <StockForm action={action} defaults={it} submitLabel="Save changes" />

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          {it.active ? 'Deactivate' : 'Reactivate'}
        </h2>
        <p className="mt-1 text-sm text-brand-slate">
          {it.active
            ? 'Hides this item from the staff count and wastage screens. History preserved.'
            : 'Brings it back to the staff screens.'}
        </p>
        <form
          action={
            it.active
              ? deactivateItem.bind(null, id)
              : reactivateItem.bind(null, id)
          }
          className="mt-3"
        >
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              it.active
                ? 'border border-brand-amber/60 bg-brand-amber/10 text-brand-forest hover:bg-brand-amber/20'
                : 'bg-brand-teal-deep text-brand-cream hover:bg-brand-teal'
            }`}
          >
            {it.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </form>
      </section>
    </main>
  )
}
