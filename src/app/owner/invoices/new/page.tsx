import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createInvoice } from '@/lib/finance/invoice-actions'

const LINE_ITEM_ROWS = 5

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string; customer?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: customers } = await admin
    .from('customers')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/invoices"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Invoices
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        New invoice
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Drafted with status &quot;draft&quot;. Mark as sent / paid after.
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

      {(customers?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-5 text-sm text-brand-forest">
          You need at least one customer first.{' '}
          <Link
            href="/owner/customers/new"
            className="font-medium text-brand-amber hover:underline"
          >
            Add a customer →
          </Link>
        </p>
      ) : (
        <form
          action={createInvoice}
          className="mt-6 space-y-6 rounded-xl border border-brand-sage/40 bg-white p-6"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="customer_id"
                className="block text-sm font-medium text-brand-forest"
              >
                Customer <span className="ml-1 text-brand-amber">*</span>
              </label>
              <select
                id="customer_id"
                name="customer_id"
                required
                defaultValue={params.customer ?? ''}
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              >
                <option value="" disabled>
                  Pick a customer
                </option>
                {(customers ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
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

          <div>
            <label
              htmlFor="due_date"
              className="block text-sm font-medium text-brand-forest"
            >
              Due date
            </label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={due}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Line items
            </legend>
            <p className="mt-1 text-xs text-brand-slate">
              Fill in as many rows as you need. Empty rows are ignored.
            </p>
            <div className="mt-3 space-y-2">
              {Array.from({ length: LINE_ITEM_ROWS }, (_, i) => (
                <div key={i} className="grid grid-cols-6 gap-2">
                  <input
                    name={`item_${i}_description`}
                    type="text"
                    placeholder="Description"
                    className="col-span-3 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  />
                  <input
                    name={`item_${i}_quantity`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Qty"
                    className="col-span-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-right text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  />
                  <input
                    name={`item_${i}_price`}
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

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-brand-forest"
            >
              Notes (shown on invoice)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Draft invoice
          </button>
        </form>
      )}
    </main>
  )
}
