import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/finance/constants'

export default async function PayeesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: payees } = await admin
    .from('payees')
    .select('id, name, default_category, active')
    .order('name')

  // Get spend total per payee in last 90 days
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const { data: expenses } = await admin
    .from('expenses')
    .select('payee_id, amount')
    .gte('date', since)

  const spendByPayee = new Map<string, number>()
  for (const e of expenses ?? []) {
    if (!e.payee_id) continue
    spendByPayee.set(
      e.payee_id,
      (spendByPayee.get(e.payee_id) ?? 0) + Number(e.amount),
    )
  }

  return (
    <main className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Payees
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Suppliers and other vendors. Auto-created from expense vendors.
          </p>
        </div>
        <Link
          href="/owner/payees/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add payee
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Default category</th>
              <th className="px-4 py-3 text-right">Spend (90d)</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(payees ?? []).map((p) => (
              <tr key={p.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {p.name}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {p.default_category
                    ? EXPENSE_CATEGORY_LABEL[p.default_category]
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  £{(spendByPayee.get(p.id) ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/payees/${p.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(payees?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No payees yet. They appear automatically as you log expenses.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
