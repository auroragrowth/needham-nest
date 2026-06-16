import Link from 'next/link'
import { computeDailyStaffingCost } from '@/lib/staffing/cost'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDate(d: string, delta: number): string {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() + delta)
  return isoDate(x)
}

export default async function StaffingCostPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const sp = await searchParams
  const today = isoDate(new Date())
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today

  // Today + the next 6 days, for a one-week glance.
  const days: string[] = []
  for (let i = -1; i < 7; i++) days.push(shiftDate(date, i))

  const breakdowns = await Promise.all(
    days.map((d) => computeDailyStaffingCost(d)),
  )

  const main = breakdowns[1] // the "selected" date

  return (
    <main className="mx-auto max-w-4xl">
      <Link
        href="/manager"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Manager
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Staffing cost
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        PAYE staff (Vic) cost the business every day, whether they clock in or
        not — annual salary ÷ 365. Hourly staff cost only the hours they&apos;ve
        actually clocked. Still-on-shift entries count up to right now.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/manager/staffing-cost?date=${shiftDate(date, -7)}`}
          className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
        >
          ← Prev week
        </Link>
        <Link
          href={`/manager/staffing-cost?date=${today}`}
          className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
        >
          Today
        </Link>
        <Link
          href={`/manager/staffing-cost?date=${shiftDate(date, 7)}`}
          className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
        >
          Next week →
        </Link>
      </div>

      <section className="mt-6 rounded-xl border-2 border-brand-amber/60 bg-brand-amber/10 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          {new Date(date + 'T00:00:00Z').toLocaleDateString([], {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {date === today && ' · today'}
        </h2>
        <p className="mt-2 text-3xl font-semibold text-brand-forest">
          £{main.total.toFixed(2)}
        </p>
        <p className="text-xs text-brand-slate">
          £{main.paye_baseline.toFixed(2)} PAYE baseline · £
          {main.hourly_variable.toFixed(2)} rostered hourly
        </p>

        {main.paye_people.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
              PAYE (always-on)
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {main.paye_people.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-mono">£{p.daily_cost.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {main.hourly_people.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-slate">
              Hourly (rostered)
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {main.hourly_people.map((p) => (
                <li key={p.id} className="rounded border border-brand-sage/30 bg-white p-2">
                  <div className="flex justify-between gap-2">
                    <span>
                      <span className="font-semibold">{p.name}</span>{' '}
                      <span className="text-xs text-brand-slate">
                        {p.hours.toFixed(2)}h × £{p.rate.toFixed(2)}
                      </span>
                      {p.still_clocked_in && (
                        <span className="ml-1 rounded bg-brand-teal-deep/15 px-1 text-[10px] font-semibold uppercase text-brand-teal-deep">
                          on shift
                        </span>
                      )}
                    </span>
                    <span className="font-mono">£{p.cost.toFixed(2)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-brand-slate">
                    {p.segments.map((seg, i) => (
                      <li key={i} className="font-mono">
                        {new Date(seg.clock_in).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' – '}
                        {seg.clock_out
                          ? new Date(seg.clock_out).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'now (still on)'}{' '}
                        ({seg.hours.toFixed(2)}h)
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {main.paye_people.length === 0 && main.hourly_people.length === 0 && (
          <p className="mt-3 text-sm text-brand-slate">
            No staffing cost recorded for this day.
          </p>
        )}
      </section>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Week glance
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Day
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate">
                PAYE
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Hourly
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdowns.map((b) => (
              <tr key={b.date}>
                <td className="border-b border-brand-sage/30 px-3 py-2">
                  <Link
                    href={`/manager/staffing-cost?date=${b.date}`}
                    className={
                      b.date === date
                        ? 'font-semibold text-brand-amber hover:underline'
                        : 'text-brand-forest hover:underline'
                    }
                  >
                    {new Date(b.date + 'T00:00:00Z').toLocaleDateString([], {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Link>
                </td>
                <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs">
                  £{b.paye_baseline.toFixed(2)}
                </td>
                <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs">
                  £{b.hourly_variable.toFixed(2)}
                </td>
                <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs font-semibold">
                  £{b.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Window total
              </td>
              <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-xs">
                £
                {breakdowns
                  .reduce((a, b) => a + b.paye_baseline, 0)
                  .toFixed(2)}
              </td>
              <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-xs">
                £
                {breakdowns
                  .reduce((a, b) => a + b.hourly_variable, 0)
                  .toFixed(2)}
              </td>
              <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-xs font-semibold">
                £
                {breakdowns.reduce((a, b) => a + b.total, 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  )
}
