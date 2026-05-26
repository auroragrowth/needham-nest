import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/finance/constants'

export default async function ExpensesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: rows } = await admin
    .from('expenses')
    .select('id, date, category, vendor, amount, payment_method, reference')
    .gte('date', since)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  const total = (rows ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0)

  const byCategory = new Map<string, number>()
  for (const r of rows ?? []) {
    const cur = byCategory.get(r.category) ?? 0
    byCategory.set(r.category, cur + Number(r.amount ?? 0))
  }

  return (
    <main className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Last 90 days. Vendors auto-create as payees when you save.
          </p>
        </div>
        <Link
          href="/owner/expenses/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add expense
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <p className="text-sm text-brand-slate">Total (90d)</p>
        <p className="mt-1 text-3xl font-semibold text-brand-forest">
          £{total.toFixed(2)}
        </p>
        {byCategory.size > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
            {Array.from(byCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <li
                  key={cat}
                  className="rounded-md border border-brand-sage/40 px-3 py-2"
                >
                  <p className="text-brand-slate">
                    {EXPENSE_CATEGORY_LABEL[cat] ?? cat}
                  </p>
                  <p className="font-mono text-brand-forest">
                    £{amt.toFixed(2)}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 text-brand-forest">
                  {new Date(r.date).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-brand-forest">{r.vendor}</td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {EXPENSE_CATEGORY_LABEL[r.category] ?? r.category}
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  £{Number(r.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {r.payment_method ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/expenses/${r.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
