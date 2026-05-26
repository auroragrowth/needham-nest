import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

function fmt(n: number | null): string {
  if (n == null) return '—'
  return `£${n.toFixed(2)}`
}

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: counts }, { data: movements }, { data: staff }] =
    await Promise.all([
      admin
        .from('cash_counts')
        .select('id, date, counted, expected, difference, notes, user_id')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('cash_movements')
        .select('id, date, direction, amount, reason, reference, user_id')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20),
      admin.from('profiles').select('id, name'),
    ])

  const nameById = new Map((staff ?? []).map((p) => [p.id, p.name]))

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Cash
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            End-of-day counts and petty cash movements. Expected figures from
            SumUp land in Phase 3.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/manager/cash/count"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            + Cash count
          </Link>
          <Link
            href="/manager/cash/movement"
            className="rounded-lg border border-brand-forest px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-forest hover:text-brand-cream"
          >
            + Petty cash
          </Link>
        </div>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Recent counts
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Counted</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody>
            {(counts ?? []).map((c) => {
              const variance =
                c.expected != null ? c.counted - c.expected : null
              return (
                <tr key={c.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 text-brand-forest">
                    {new Date(c.date).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-forest">
                    {fmt(c.counted)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-slate">
                    {fmt(c.expected)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      variance == null
                        ? 'text-brand-slate'
                        : variance === 0
                          ? 'text-brand-teal-deep'
                          : 'text-brand-amber'
                    }`}
                  >
                    {variance == null
                      ? '—'
                      : (variance > 0 ? '+' : '') + fmt(variance)}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-slate">
                    {nameById.get(c.user_id) ?? 'Unknown'}
                  </td>
                </tr>
              )
            })}
            {(counts?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No counts recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Recent petty cash movements
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody>
            {(movements ?? []).map((m) => (
              <tr key={m.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 text-brand-forest">
                  {new Date(m.date).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                  })}
                </td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide">
                  <span
                    className={
                      m.direction === 'in'
                        ? 'text-brand-teal-deep'
                        : 'text-brand-amber'
                    }
                  >
                    {m.direction === 'in' ? '↓ In' : '↑ Out'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  {fmt(m.amount)}
                </td>
                <td className="px-4 py-3 text-brand-forest">
                  {m.reason}
                  {m.reference && (
                    <span className="ml-2 text-xs text-brand-slate">
                      ({m.reference})
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {nameById.get(m.user_id) ?? 'Unknown'}
                </td>
              </tr>
            ))}
            {(movements?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No movements recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
