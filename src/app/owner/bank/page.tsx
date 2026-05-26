import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('bank_transactions')
    .select('id, date, description, amount, matched_expense_id, matched_takings_id')
    .order('date', { ascending: false })
    .order('imported_at', { ascending: false })
    .limit(500)

  const total = rows?.length ?? 0
  const matched = (rows ?? []).filter(
    (r) => r.matched_expense_id || r.matched_takings_id,
  ).length
  const matchedPct = total === 0 ? 0 : Math.round((matched / total) * 100)

  return (
    <main className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Bank
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Monzo CSV imports. Auto-matches by exact amount within 2 days of an
            existing expense or takings entry.
          </p>
        </div>
        <Link
          href="/owner/bank/upload"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Upload CSV
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <p className="text-sm text-brand-slate">
          Match rate: <strong className="text-brand-forest">{matchedPct}%</strong>{' '}
          ({matched} of {total})
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Matched</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const matched = Boolean(r.matched_expense_id || r.matched_takings_id)
              return (
                <tr key={r.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 text-brand-forest">
                    {new Date(r.date).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-brand-forest">{r.description}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      Number(r.amount) >= 0
                        ? 'text-brand-teal-deep'
                        : 'text-brand-forest'
                    }`}
                  >
                    {Number(r.amount) >= 0 ? '+' : ''}£
                    {Math.abs(Number(r.amount)).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {matched ? (
                      <Link
                        href={
                          r.matched_expense_id
                            ? `/owner/expenses/${r.matched_expense_id}`
                            : '/owner/takings'
                        }
                        className="text-brand-teal-deep hover:underline"
                      >
                        ✓ {r.matched_expense_id ? 'Expense' : 'Takings'}
                      </Link>
                    ) : (
                      <span className="text-brand-amber">Unmatched</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No transactions imported yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
