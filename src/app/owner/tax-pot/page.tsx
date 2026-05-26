import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { createPotAllocation } from '@/lib/finance/dl-actions'

function startOfYearIso(): string {
  const d = new Date()
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export default async function TaxPotPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')

  const admin = createAdminClient()

  const yearStart = startOfYearIso()
  const [{ data: allocations }, { data: settings }, { data: expenses }, { data: takings }] =
    await Promise.all([
      admin
        .from('pot_allocations')
        .select('id, date, amount, note')
        .eq('pot', 'tax')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      session.authUserId
        ? admin
            .from('settings')
            .select('ct_rate, company_name')
            .eq('user_id', session.authUserId)
            .maybeSingle()
        : Promise.resolve({ data: null } as { data: null }),
      admin.from('expenses').select('amount').gte('date', yearStart),
      admin.from('takings').select('amount').gte('date', yearStart),
    ])

  const balance = (allocations ?? []).reduce(
    (a, r) => a + Number(r.amount),
    0,
  )
  const expenseYTD = (expenses ?? []).reduce(
    (a, r) => a + Number(r.amount ?? 0),
    0,
  )
  const takingsYTD = (takings ?? []).reduce(
    (a, r) => a + Number(r.amount ?? 0),
    0,
  )
  const profitYTD = takingsYTD - expenseYTD
  const ctRate = Number(settings?.ct_rate ?? 19) / 100
  const ctEstimate = Math.max(0, profitYTD * ctRate)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Tax pot
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Money set aside for corporation tax. Estimate based on year-to-date P&amp;L
        and your CT rate from settings.
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Pot balance" value={`£${balance.toFixed(2)}`} tone="teal" />
        <Stat
          label="Estimated CT (YTD)"
          value={`£${ctEstimate.toFixed(2)}`}
          tone="amber"
        />
        <Stat
          label="Pot vs estimate"
          value={
            ctEstimate === 0
              ? '—'
              : `${Math.round((balance / ctEstimate) * 100)}%`
          }
          tone={balance >= ctEstimate ? 'teal' : 'amber'}
        />
      </div>

      <div className="mt-2 text-xs text-brand-slate">
        YTD profit £{profitYTD.toFixed(2)} × CT rate{' '}
        {(ctRate * 100).toFixed(1)}%
      </div>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          New allocation
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          Positive = money moved INTO the pot. Negative = withdrawal (e.g.
          paying CT to HMRC).
        </p>
        <form
          action={createPotAllocation}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <input
            name="date"
            type="date"
            defaultValue={today}
            className="rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
          <input
            name="amount"
            type="number"
            step="0.01"
            required
            placeholder="Amount (£)"
            inputMode="decimal"
            className="rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
          <input
            name="note"
            type="text"
            placeholder="Note (optional)"
            className="rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30 sm:col-span-1"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Add
          </button>
        </form>
      </section>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        History
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {(allocations ?? []).map((a) => (
              <tr key={a.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 text-brand-forest">
                  {new Date(a.date).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    Number(a.amount) >= 0
                      ? 'text-brand-teal-deep'
                      : 'text-brand-amber'
                  }`}
                >
                  {Number(a.amount) >= 0 ? '+' : ''}£
                  {Math.abs(Number(a.amount)).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-brand-forest">{a.note ?? '—'}</td>
              </tr>
            ))}
            {(allocations?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No allocations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-brand-slate">
        Adjust CT rate in{' '}
        <Link
          href="/owner/onboarding"
          className="text-brand-amber hover:underline"
        >
          Company settings
        </Link>
        .
      </p>
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
