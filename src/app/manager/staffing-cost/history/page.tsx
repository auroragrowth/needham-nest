import Link from 'next/link'
import { computeStaffingCostRange } from '@/lib/staffing/cost'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDate(d: string, delta: number): string {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() + delta)
  return isoDate(x)
}

export default async function StaffingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>
}) {
  const sp = await searchParams
  const today = isoDate(new Date())

  // Default: month-to-date
  const monthStart = today.slice(0, 7) + '-01'
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : monthStart
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today

  const days = await computeStaffingCostRange(from, to)
  const periodTotal = days.length > 0 ? days[days.length - 1].cumulative : 0
  const paye_total = days.reduce((a, d) => a + d.paye, 0)
  const hourly_total = days.reduce((a, d) => a + d.hourly, 0)

  // DayOfWeek-aware running shape: highest cost day in the period
  const peak = days.reduce(
    (p, d) => (d.total > p.total ? d : p),
    { date: '—', total: 0 } as { date: string; total: number },
  )

  return (
    <main className="mx-auto max-w-5xl">
      <Link
        href="/manager/staffing-cost"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Today
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Staffing cost — day by day
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Every day in the period, with a running cumulative total. PAYE
        baseline applies every day; hourly cost comes from clocked
        timesheets.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <PresetLink
          href={`/manager/staffing-cost/history?from=${shiftDate(today, -7)}&to=${today}`}
          label="Last 7 days"
        />
        <PresetLink
          href={`/manager/staffing-cost/history?from=${monthStart}&to=${today}`}
          label="Month to date"
        />
        <PresetLink
          href={`/manager/staffing-cost/history?from=${shiftDate(today, -30)}&to=${today}`}
          label="Last 30 days"
        />
        <PresetLink
          href={`/manager/staffing-cost/history?from=${shiftDate(today, -90)}&to=${today}`}
          label="Last 90 days"
        />
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-brand-sage/40 bg-white p-4">
        <div>
          <label
            htmlFor="from"
            className="block text-xs font-medium text-brand-forest"
          >
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            style={{ minHeight: '44px' }}
          />
        </div>
        <div>
          <label
            htmlFor="to"
            className="block text-xs font-medium text-brand-forest"
          >
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            style={{ minHeight: '44px' }}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Apply
        </button>
      </form>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Period total"
          value={`£${periodTotal.toFixed(2)}`}
          sub={`${days.length} day${days.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="PAYE baseline"
          value={`£${paye_total.toFixed(2)}`}
          sub="Vic, every day"
        />
        <Stat
          label="Hourly variable"
          value={`£${hourly_total.toFixed(2)}`}
          sub={`Peak: ${peak.date === '—' ? '—' : new Date(peak.date + 'T00:00:00Z').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} (£${peak.total.toFixed(2)})`}
        />
      </section>

      <div className="mt-6 overflow-x-auto">
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
                Day total
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Running
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const isToday = d.date === today
              return (
                <tr key={d.date} className={isToday ? 'bg-brand-amber/10' : ''}>
                  <td className="border-b border-brand-sage/30 px-3 py-2">
                    <Link
                      href={`/manager/staffing-cost?date=${d.date}`}
                      className="text-brand-forest hover:text-brand-amber hover:underline"
                    >
                      {new Date(d.date + 'T00:00:00Z').toLocaleDateString([], {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                      {isToday && (
                        <span className="ml-1 text-[10px] text-brand-amber">
                          today
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs">
                    £{d.paye.toFixed(2)}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs">
                    £{d.hourly.toFixed(2)}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs font-semibold">
                    £{d.total.toFixed(2)}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs text-brand-teal-deep">
                    £{d.cumulative.toFixed(2)}
                  </td>
                </tr>
              )
            })}
            {days.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-brand-slate"
                >
                  Nothing in that range.
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
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-brand-sage/40 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-brand-forest">{value}</p>
      {sub && <p className="mt-1 text-xs text-brand-slate">{sub}</p>}
    </div>
  )
}

function PresetLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
    >
      {label}
    </Link>
  )
}
