import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function DirectorLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('director_loans')
    .select('id, date, direction, amount, description, reference')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  // Balance: sum of 'in' minus sum of 'out' = money the company owes the director
  const totalIn = (rows ?? [])
    .filter((r) => r.direction === 'in')
    .reduce((a, r) => a + Number(r.amount), 0)
  const totalOut = (rows ?? [])
    .filter((r) => r.direction === 'out')
    .reduce((a, r) => a + Number(r.amount), 0)
  const balance = totalIn - totalOut

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Director&apos;s loan account
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Track money the director puts into and takes out of the company.
          </p>
        </div>
        <Link
          href="/owner/director-loan/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add entry
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Director → Company"
          value={`£${totalIn.toFixed(2)}`}
          tone="teal"
        />
        <Stat
          label="Company → Director"
          value={`£${totalOut.toFixed(2)}`}
          tone="amber"
        />
        <Stat
          label="Company owes director"
          value={`${balance < 0 ? '-' : ''}£${Math.abs(balance).toFixed(2)}`}
          tone={balance >= 0 ? 'teal' : 'amber'}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Ref</th>
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
                <td className="px-4 py-3 text-xs">
                  <span
                    className={
                      r.direction === 'in'
                        ? 'text-brand-teal-deep'
                        : 'text-brand-amber'
                    }
                  >
                    {r.direction === 'in'
                      ? '↓ Director → Company'
                      : '↑ Company → Director'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  £{Number(r.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-brand-forest">
                  {r.description ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {r.reference ?? '—'}
                </td>
              </tr>
            ))}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'teal' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-brand-sage/40 bg-white p-5">
      <p className="text-xs text-brand-slate">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === 'teal' ? 'text-brand-teal-deep' : 'text-brand-amber'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
