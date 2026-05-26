import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordDelivery } from '@/lib/suppliers/actions'

const ROWS = 8

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const [{ data: suppliers }, { data: stock }] = await Promise.all([
    admin
      .from('suppliers')
      .select('id, name')
      .eq('active', true)
      .order('name'),
    admin
      .from('stock_items')
      .select('id, name, unit, cost_price')
      .eq('active', true)
      .order('name'),
  ])

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/owner/deliveries"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Deliveries
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Record delivery
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Fills in stock movements + auto-creates the supplier expense.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      {(suppliers?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-5 text-sm text-brand-forest">
          You need at least one supplier first.{' '}
          <Link
            href="/owner/suppliers/new"
            className="font-medium text-brand-amber hover:underline"
          >
            Add a supplier →
          </Link>
        </p>
      ) : (suppliers?.length ?? 0) > 0 && (stock?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-5 text-sm text-brand-forest">
          You need at least one stock item first.{' '}
          <Link
            href="/owner/stock/new"
            className="font-medium text-brand-amber hover:underline"
          >
            Add stock →
          </Link>
        </p>
      ) : (
        <form
          action={recordDelivery}
          className="mt-6 space-y-6 rounded-xl border border-brand-sage/40 bg-white p-6"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="supplier_id"
                className="block text-sm font-medium text-brand-forest"
              >
                Supplier <span className="ml-1 text-brand-amber">*</span>
              </label>
              <select
                id="supplier_id"
                name="supplier_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              >
                <option value="" disabled>
                  Pick a supplier
                </option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-brand-forest"
              >
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={today}
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Line items
            </legend>
            <p className="mt-1 text-xs text-brand-slate">
              Stock movements get inserted for each line. Leave blank to skip.
            </p>
            <div className="mt-3 space-y-2">
              {Array.from({ length: ROWS }, (_, i) => (
                <div key={i} className="grid grid-cols-7 gap-2">
                  <select
                    name={`item_${i}_id`}
                    defaultValue=""
                    className="col-span-3 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  >
                    <option value="">(none)</option>
                    {(stock ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (per {s.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    name={`item_${i}_qty`}
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="Qty"
                    className="col-span-2 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-right text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  />
                  <input
                    name={`item_${i}_cost`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Unit £"
                    className="col-span-2 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-right text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reference"
                className="block text-sm font-medium text-brand-forest"
              >
                Reference
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                placeholder="Invoice / docket no."
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-brand-forest"
              >
                Notes
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Record delivery
          </button>
        </form>
      )}
    </main>
  )
}
