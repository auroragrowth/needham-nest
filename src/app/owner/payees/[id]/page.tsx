import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { updatePayee } from '@/lib/finance/actions'
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
} from '@/lib/finance/constants'

export default async function EditPayeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: p } = await admin
    .from('payees')
    .select('id, name, default_category, notes, active')
    .eq('id', id)
    .maybeSingle()
  if (!p) notFound()

  const { data: recent } = await admin
    .from('expenses')
    .select('id, date, category, vendor, amount')
    .eq('payee_id', id)
    .order('date', { ascending: false })
    .limit(20)

  const action = updatePayee.bind(null, id)

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/owner/payees"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payees
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {p.name}
      </h1>

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

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={p.name}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="default_category"
            className="block text-sm font-medium text-brand-forest"
          >
            Default category
          </label>
          <select
            id="default_category"
            name="default_category"
            defaultValue={p.default_category ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="">(none)</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-brand-forest"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={p.notes ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Save changes
        </button>
      </form>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Recent expenses
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((e) => (
              <tr key={e.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/owner/expenses/${e.id}`}
                    className="text-brand-amber hover:underline"
                  >
                    {new Date(e.date).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {EXPENSE_CATEGORY_LABEL[e.category] ?? e.category}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  £{Number(e.amount).toFixed(2)}
                </td>
              </tr>
            ))}
            {(recent?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No expenses recorded for this payee yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
