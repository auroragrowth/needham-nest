import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildStaffPayslip } from '@/lib/staffing/cost'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from './PrintButton'

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
    year: 'numeric',
  })
}

export default async function StaffPayslipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : monthStart
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today

  const payslip = await buildStaffPayslip(id, from, to)
  if (!payslip) notFound()

  const isPaye = payslip.employment_type === 'paye'

  // Saved payslips for this staff member (most recent first).
  const admin = createAdminClient()
  const { data: saved } = await admin
    .from('payslips')
    .select(
      'id, pay_date, period_from, period_to, gross_pay, net_pay, slip_number, paid_at, paid_method',
    )
    .eq('staff_id', id)
    .order('pay_date', { ascending: false })
    .limit(12)

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/owner/payslips"
        className="text-sm text-brand-amber hover:underline print:hidden"
      >
        ← Payslips
      </Link>
      <header className="mt-2 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            {payslip.staff_name}
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            {fmtDate(from)} – {fmtDate(to)}
            {isPaye && ' · PAYE (salaried)'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/owner/payslips/${id}/generate?from=${from}&to=${to}`}
            className="rounded-lg bg-brand-amber px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
          >
            Generate payslip →
          </Link>
          <PrintButton />
        </div>
      </header>

      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-brand-sage/40 bg-white p-4 print:hidden">
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
            className="mt-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
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
            className="mt-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
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

      {isPaye && (
        <section className="mt-6 rounded-xl border-2 border-brand-amber/60 bg-brand-amber/10 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Salary for the period
          </h2>
          <p className="mt-2 text-3xl font-semibold text-brand-forest">
            £{payslip.paye_total.toFixed(2)}
          </p>
          <p className="text-xs text-brand-slate">
            {payslip.paye_days} day{payslip.paye_days === 1 ? '' : 's'} ×
            annual salary ÷ 365
          </p>
          {payslip.shifts.length > 0 && (
            <p className="mt-2 text-xs text-brand-slate">
              Plus {payslip.total_hours.toFixed(1)}h of additional clocked time
              recorded below. PAYE salary is paid regardless — these are for
              attendance only.
            </p>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Shifts ({payslip.shifts.length})
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
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
              {payslip.shifts.map((s, i) => (
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
              {payslip.shifts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-sm text-brand-slate"
                  >
                    No shifts clocked in this period.
                  </td>
                </tr>
              )}
            </tbody>
            {payslip.shifts.length > 0 && (
              <tfoot>
                <tr>
                  <td
                    colSpan={3}
                    className="border-t-2 border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate"
                  >
                    Totals
                  </td>
                  <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-sm font-semibold">
                    {payslip.total_hours.toFixed(2)}h
                  </td>
                  <td className="border-t-2 border-brand-sage/40 px-3 py-2" />
                  <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-sm font-semibold">
                    £{payslip.total_gross.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {(saved?.length ?? 0) > 0 && (
        <section className="mt-8 print:hidden">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Saved payslips
          </h2>
          <ul className="mt-3 space-y-1">
            {(saved ?? []).map((ps) => (
              <li
                key={ps.id}
                className="flex items-baseline justify-between gap-3 rounded-md border border-brand-sage/40 bg-white px-3 py-2 text-sm"
              >
                <Link
                  href={`/owner/payslips/${id}/${ps.id}`}
                  className="text-brand-forest hover:text-brand-amber hover:underline"
                >
                  <span className="font-mono text-xs text-brand-teal-deep">
                    {ps.slip_number ?? '—'}
                  </span>{' '}
                  {ps.paid_at ? (
                    <span className="ml-1 rounded bg-brand-teal-deep/15 px-1 text-[10px] font-semibold text-brand-teal-deep">
                      ✓ paid
                    </span>
                  ) : (
                    <span className="ml-1 rounded bg-brand-amber/30 px-1 text-[10px] font-semibold text-brand-forest">
                      unpaid
                    </span>
                  )}{' '}
                  <span className="text-xs text-brand-slate">
                    · {fmtDate(ps.period_from)} – {fmtDate(ps.period_to)}
                  </span>
                </Link>
                <span className="font-mono text-xs">
                  £{Number(ps.gross_pay).toFixed(2)} gross ·{' '}
                  <span className="font-semibold">
                    £{Number(ps.net_pay).toFixed(2)} net
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-[10px] text-brand-slate">
        Hours and gross figures are derived from clock-in / clock-out
        timestamps. Statutory deductions (income tax, NI, pension) are
        applied by your payroll software, not this report.
      </p>
    </main>
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
