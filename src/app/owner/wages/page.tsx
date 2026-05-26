import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWages } from '@/lib/wages/actions'

function weekRange() {
  // Default: previous Mon..Sun (last full week)
  const d = new Date()
  const dow = (d.getDay() + 6) % 7 // Mon=0..Sun=6
  d.setDate(d.getDate() - dow - 7)
  const start = d.toISOString().slice(0, 10)
  d.setDate(d.getDate() + 6)
  const end = d.toISOString().slice(0, 10)
  return { start, end }
}

export default async function WagesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: wages }, { data: staff }] = await Promise.all([
    admin
      .from('wage_payments')
      .select('id, staff_user_id, period_start, period_end, hours, gross, paid_at')
      .order('period_start', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('profiles').select('id, name'),
  ])

  const staffNameById = new Map((staff ?? []).map((p) => [p.id, p.name]))
  const unpaidTotal = (wages ?? [])
    .filter((w) => !w.paid_at)
    .reduce((a, w) => a + Number(w.gross ?? 0), 0)

  const { start, end } = weekRange()

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Wages
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Gross wages generated from clock-in/out data. This is bookkeeping —
        you still file PAYE / RTI through BrightPay or Xero Payroll.
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

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Generate wages for a period
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          One wage record per staff member, computed as hours × hourly rate
          (snapshot from the staff profile).
        </p>
        <form action={generateWages} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Period start
            </label>
            <input
              name="period_start"
              type="date"
              defaultValue={start}
              required
              className="mt-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Period end
            </label>
            <input
              name="period_end"
              type="date"
              defaultValue={end}
              required
              className="mt-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Generate
          </button>
        </form>
      </section>

      <div className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <p className="text-sm text-brand-slate">Unpaid total</p>
        <p className="mt-1 text-3xl font-semibold text-brand-forest">
          £{unpaidTotal.toFixed(2)}
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(wages ?? []).map((w) => (
              <tr key={w.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {staffNameById.get(w.staff_user_id) ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {w.period_start} → {w.period_end}
                </td>
                <td className="px-4 py-3 text-right font-mono">{w.hours}</td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  £{Number(w.gross).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs">
                  {w.paid_at ? (
                    <span className="text-brand-teal-deep">
                      Paid{' '}
                      {new Date(w.paid_at).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  ) : (
                    <span className="text-brand-amber">Unpaid</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/wages/${w.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {(wages?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No wage records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
