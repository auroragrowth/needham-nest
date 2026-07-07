import Link from 'next/link'
import { computeWeeklyStaffMatrix } from '@/lib/staffing/cost'
import { PrintButton } from '../../payslips/[id]/PrintButton'

// Don't cache: clock-ins change throughout the day.
export const dynamic = 'force-dynamic'
export const revalidate = 0

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfWeekMonUTC(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  const dow = x.getUTCDay()
  const offset = (dow + 6) % 7
  x.setUTCDate(x.getUTCDate() - offset)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function dayLabel(iso: string): { day: string; date: string } {
  const d = new Date(iso + 'T00:00:00Z')
  return {
    day: d.toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'short' }),
    date: d.toLocaleDateString('en-GB', {
      timeZone: 'Europe/London',
      day: 'numeric',
      month: 'short',
    }),
  }
}

export default async function StaffCostsWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const weekStart =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? startOfWeekMonUTC(new Date(sp.week + 'T00:00:00Z'))
      : startOfWeekMonUTC(now)
  const weekEnd = addDays(weekStart, 6)
  const from = isoDate(weekStart)
  const to = isoDate(weekEnd)

  const m = await computeWeeklyStaffMatrix(from, to)

  return (
    <main className="mx-auto max-w-5xl print:max-w-none">
      <Link
        href="/owner"
        className="text-sm text-brand-amber hover:underline print:hidden"
      >
        ← Dashboard
      </Link>

      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Staff cost — week overview
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            {dayLabel(from).date} – {dayLabel(to).date} · UK time
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link
            href={`/owner/staff-costs/week?week=${isoDate(addDays(weekStart, -7))}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            ← Prev
          </Link>
          <Link
            href="/owner/staff-costs/week"
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            This week
          </Link>
          <Link
            href={`/owner/staff-costs/week?week=${isoDate(addDays(weekStart, 7))}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            Next →
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Week total"
          value={`£${m.week_grand.toFixed(2)}`}
          sub={`${m.staff.length} ${m.staff.length === 1 ? 'person' : 'people'}`}
        />
        <Stat
          label="Average / day"
          value={`£${(m.week_grand / 7).toFixed(2)}`}
        />
        <Stat
          label="Highest day"
          value={`£${Math.max(0, ...m.day_totals).toFixed(2)}`}
          sub={
            m.day_totals.some((x) => x > 0)
              ? dayLabel(
                  m.days[m.day_totals.indexOf(Math.max(...m.day_totals))],
                ).day +
                ' ' +
                dayLabel(
                  m.days[m.day_totals.indexOf(Math.max(...m.day_totals))],
                ).date
              : undefined
          }
        />
      </section>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Day</Th>
              {m.staff.map((s) => (
                <Th key={s.id} right>
                  {s.name.split(' ')[0]}
                  {s.employment_type === 'paye' && (
                    <span className="block text-[8px] font-normal normal-case text-brand-slate">
                      PAYE
                    </span>
                  )}
                </Th>
              ))}
              <Th right>Day total</Th>
              <Th right>Running</Th>
            </tr>
          </thead>
          <tbody>
            {m.days.map((d, i) => {
              const lbl = dayLabel(d)
              return (
                <tr key={d}>
                  <Td>
                    <span className="font-semibold">{lbl.day}</span>{' '}
                    <span className="text-xs text-brand-slate">
                      {lbl.date}
                    </span>
                  </Td>
                  {m.staff.map((s) => (
                    <Td key={s.id} right mono dim={s.per_day[i] === 0}>
                      £{s.per_day[i].toFixed(2)}
                    </Td>
                  ))}
                  <Td right mono bold>
                    £{m.day_totals[i].toFixed(2)}
                  </Td>
                  <Td right mono teal>
                    £{m.day_cumulative[i].toFixed(2)}
                  </Td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <Td bold>Week total</Td>
              {m.staff.map((s) => (
                <Td key={s.id} right mono bold>
                  £{s.week_total.toFixed(2)}
                </Td>
              ))}
              <Td right mono bold>
                £{m.week_grand.toFixed(2)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-8 text-[10px] text-brand-slate">
        PAYE staff are charged daily salary share (annual ÷ 365) whether
        clocked or not. Hourly staff are charged for clocked time only,
        using the rate snapshotted at clock-in. Owner-draw excluded.
      </p>
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

function Th({
  children,
  right,
}: {
  children: React.ReactNode
  right?: boolean
}) {
  return (
    <th
      className={`border-b border-brand-sage/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand-slate ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  right,
  mono,
  bold,
  dim,
  teal,
}: {
  children?: React.ReactNode
  right?: boolean
  mono?: boolean
  bold?: boolean
  dim?: boolean
  teal?: boolean
}) {
  return (
    <td
      className={`border-b border-brand-sage/30 px-3 py-2 ${
        right ? 'text-right' : ''
      } ${mono ? 'font-mono text-xs' : 'text-sm'} ${
        bold ? 'font-semibold' : ''
      } ${dim ? 'text-brand-slate' : ''} ${
        teal ? 'text-brand-teal-deep' : ''
      }`}
    >
      {children}
    </td>
  )
}
