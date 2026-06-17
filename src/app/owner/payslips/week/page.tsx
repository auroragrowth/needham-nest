import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildStaffPayslip } from '@/lib/staffing/cost'
import { PrintButton } from '../[id]/PrintButton'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfWeekMonUTC(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  const dow = x.getUTCDay() // 0=Sun..6=Sat
  const offset = (dow + 6) % 7 // Mon=0..Sun=6
  x.setUTCDate(x.getUTCDate() - offset)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function fmtTime(iso: string | null): string {
  if (!iso) return '— still on —'
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default async function WeeklyHoursPage({
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

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('profiles')
    .select('id, name, role, employment_type, annual_salary, hourly_rate')
    .eq('active', true)
    .order('name')

  const payslips = await Promise.all(
    (staff ?? []).map((s) => buildStaffPayslip(s.id, from, to)),
  )

  const withShifts = payslips.filter(
    (p): p is NonNullable<typeof p> =>
      p !== null &&
      (p.shifts.length > 0 ||
        p.employment_type === 'paye' ||
        p.total_hours > 0),
  )

  const grandHours = withShifts.reduce((a, p) => a + p.total_hours, 0)
  const grandHourlyGross = withShifts.reduce(
    (a, p) => a + p.total_gross,
    0,
  )
  const grandPaye = withShifts.reduce((a, p) => a + p.paye_total, 0)
  const grandTotal = grandHourlyGross + grandPaye

  return (
    <main className="mx-auto max-w-4xl print:max-w-none">
      <Link
        href="/owner/payslips"
        className="text-sm text-brand-amber hover:underline print:hidden"
      >
        ← Payslips
      </Link>

      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Weekly staff hours
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            {fmtDate(from)} – {fmtDate(to)}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link
            href={`/owner/payslips/week?week=${isoDate(addDays(weekStart, -7))}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            ← Prev
          </Link>
          <Link
            href="/owner/payslips/week"
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            This week
          </Link>
          <Link
            href={`/owner/payslips/week?week=${isoDate(addDays(weekStart, 7))}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            Next →
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total hours" value={`${grandHours.toFixed(2)}h`} />
        <Stat label="Hourly gross" value={`£${grandHourlyGross.toFixed(2)}`} />
        <Stat
          label="Week total"
          value={`£${grandTotal.toFixed(2)}`}
          sub={
            grandPaye > 0
              ? `incl. £${grandPaye.toFixed(2)} PAYE`
              : undefined
          }
        />
      </section>

      <div className="mt-6 space-y-6">
        {withShifts.map((p) => {
          const isPaye = p.employment_type === 'paye'
          return (
            <section
              key={p.staff_id}
              className="break-inside-avoid rounded-xl border border-brand-sage/40 bg-white p-4"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-brand-forest">
                  {p.staff_name}
                </h2>
                <span className="text-xs text-brand-slate">
                  {isPaye ? 'PAYE' : 'Casual / hourly'} ·{' '}
                  {p.shifts.length} shift{p.shifts.length === 1 ? '' : 's'}
                </span>
              </header>

              {isPaye && p.paye_total > 0 && (
                <p className="mt-1 text-sm text-brand-forest">
                  Salary share this week:{' '}
                  <span className="font-mono font-semibold">
                    £{p.paye_total.toFixed(2)}
                  </span>{' '}
                  <span className="text-xs text-brand-slate">
                    ({p.paye_days} days × annual ÷ 365)
                  </span>
                </p>
              )}

              {p.shifts.length === 0 ? (
                <p className="mt-2 text-xs text-brand-slate">
                  {isPaye ? 'No additional clocked time this week.' : 'No shifts this week.'}
                </p>
              ) : (
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Start</Th>
                      <Th>Finish</Th>
                      <Th right>Hours</Th>
                      <Th right>Rate</Th>
                      <Th right>Gross</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.shifts.map((s, i) => (
                      <tr key={i}>
                        <Td>{fmtDate(s.date)}</Td>
                        <Td mono>{fmtTime(s.clock_in)}</Td>
                        <Td mono>{fmtTime(s.clock_out)}</Td>
                        <Td right mono>
                          {s.hours.toFixed(2)}
                        </Td>
                        <Td right mono>
                          £{s.rate.toFixed(2)}
                        </Td>
                        <Td right mono>
                          £{s.cost.toFixed(2)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan={3}
                        className="border-t-2 border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate"
                      >
                        Subtotal
                      </td>
                      <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-sm font-semibold">
                        {p.total_hours.toFixed(2)}h
                      </td>
                      <td className="border-t-2 border-brand-sage/40 px-3 py-2" />
                      <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-sm font-semibold">
                        £{p.total_gross.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          )
        })}

        {withShifts.length === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-6 text-center text-sm text-brand-slate">
            No clocked shifts this week.
          </p>
        )}
      </div>

      <p className="mt-8 text-[10px] text-brand-slate">
        All times shown in GMT. Hours derived from clock-in / clock-out
        timestamps; PAYE salary share is annual / 365 × days in the week.
        Gross figures pre-tax — statutory deductions are applied by your
        payroll software.
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
}: {
  children: React.ReactNode
  right?: boolean
  mono?: boolean
}) {
  return (
    <td
      className={`border-b border-brand-sage/30 px-3 py-2 text-sm ${
        right ? 'text-right' : ''
      } ${mono ? 'font-mono text-xs' : ''}`}
    >
      {children}
    </td>
  )
}
