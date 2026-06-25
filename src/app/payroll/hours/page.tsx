import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildStaffPayslip } from '@/lib/staffing/cost'

export const dynamic = 'force-dynamic'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function startOfMonUTC(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  const dow = x.getUTCDay()
  const offset = (dow + 6) % 7
  x.setUTCDate(x.getUTCDate() - offset)
  return x
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtTime(iso: string | null): string {
  if (!iso) return '— on shift —'
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function PayrollWeeklyHours({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; week?: string }>
}) {
  const sp = await searchParams
  const now = new Date()

  // Default: last completed Mon–Sun
  const todayMon = startOfMonUTC(now)
  const lastSun = addDays(todayMon, -1)
  const lastMon = addDays(lastSun, -6)
  const defaultFrom = isoDate(lastMon)
  const defaultTo = isoDate(lastSun)

  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : defaultFrom
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : defaultTo

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('profiles')
    .select('id, name, role, employment_type')
    .eq('active', true)
    .eq('payroll_included', true)
    .neq('role', 'payroll')
    .order('name')

  const payslips = await Promise.all(
    (staff ?? []).map((s) => buildStaffPayslip(s.id, from, to)),
  )
  const rows = payslips.filter((p): p is NonNullable<typeof p> => p !== null)

  const totalHours = rows.reduce((a, r) => a + r.total_hours, 0)
  const totalGross = rows.reduce((a, r) => a + r.total_gross, 0)

  return (
    <main className="mx-auto max-w-4xl">
      <Link
        href="/payroll"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payroll
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Weekly hours
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {fmtDate(from)} – {fmtDate(to)} · GMT · every shift below counts
        clocked time minus unpaid breaks.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-brand-sage/40 bg-white p-4">
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-brand-forest">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-brand-forest">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Apply
        </button>
      </form>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="People" value={`${rows.length}`} />
        <Stat label="Total hours" value={`${totalHours.toFixed(2)}h`} />
        <Stat label="Gross total" value={`£${totalGross.toFixed(2)}`} />
      </section>

      <div className="mt-6 space-y-6">
        {rows.map((p) => (
          <section
            key={p.staff_id}
            className="break-inside-avoid rounded-xl border border-brand-sage/40 bg-white p-4"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-brand-forest">
                {p.staff_name}
              </h2>
              <span className="text-xs text-brand-slate">
                {p.employment_type === 'paye' ? 'PAYE' : 'Casual / hourly'} ·{' '}
                {p.shifts.length} shift{p.shifts.length === 1 ? '' : 's'}
              </span>
            </header>

            {p.shifts.length === 0 ? (
              <p className="mt-2 text-xs text-brand-slate">
                No clocked shifts this period.
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
                      <Td right mono>{s.hours.toFixed(2)}</Td>
                      <Td right mono>£{s.rate.toFixed(2)}</Td>
                      <Td right mono>£{s.cost.toFixed(2)}</Td>
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

            <p className="mt-2 text-xs text-brand-slate">
              <Link
                className="text-brand-amber hover:underline"
                href={`/payroll/payslips/generate?staff=${p.staff_id}&from=${from}&to=${to}`}
              >
                Generate payslip for this period →
              </Link>
            </p>
          </section>
        ))}
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-sage/40 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-brand-forest">{value}</p>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
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
      className={`border-b border-brand-sage/30 px-3 py-2 ${
        right ? 'text-right' : ''
      } ${mono ? 'font-mono text-xs' : 'text-sm'}`}
    >
      {children}
    </td>
  )
}
