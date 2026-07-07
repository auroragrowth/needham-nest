import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return '£0.00'
  return `£${Number(n).toFixed(2)}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function PayrollRunsListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: runs } = await admin
    .from('payroll_runs')
    .select('*')
    .order('pay_date', { ascending: false })

  const list = runs ?? []

  // HMRC POT — running total of what still needs putting aside.
  // Draft/filed runs are still owed; paid runs are settled.
  const owed = list.filter((r) => r.status !== 'paid')
  const paid = list.filter((r) => r.status === 'paid')

  const owed_tax = owed.reduce((a, r) => a + Number(r.tax_deducted), 0)
  const owed_emp_nic = owed.reduce((a, r) => a + Number(r.employee_nic), 0)
  const owed_er_nic = owed.reduce((a, r) => a + Number(r.employer_nic), 0)
  const owed_hmrc = owed.reduce((a, r) => a + Number(r.hmrc_due), 0)
  const paid_hmrc = paid.reduce((a, r) => a + Number(r.hmrc_due), 0)
  const total_net = list.reduce((a, r) => a + Number(r.total_net), 0)
  const total_gross = list.reduce((a, r) => a + Number(r.total_gross), 0)

  return (
    <main className="mx-auto max-w-5xl">
      <Link href="/owner" className="text-sm text-brand-amber hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Payroll runs
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Every weekly + monthly PAYE run from Sage, with the HMRC bill
            tracked so you know what to put aside.
          </p>
        </div>
        <Link
          href="/owner/payroll-runs/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Log a run
        </Link>
      </div>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}

      {/* HMRC POT — the thing Paul asked for */}
      <section className="mt-6 rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            🏦 HMRC pot — put aside
          </h2>
          <p className="text-xs text-brand-slate">
            From every draft / filed run below (excludes already-paid).
          </p>
        </div>
        <p className="mt-2 text-4xl font-semibold text-brand-forest">
          {fmtMoney(owed_hmrc)}
        </p>
        <p className="mt-1 text-xs text-brand-slate">
          across {owed.length} outstanding run{owed.length === 1 ? '' : 's'}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="PAYE tax" value={fmtMoney(owed_tax)} />
          <MiniStat label="Employee NIC" value={fmtMoney(owed_emp_nic)} />
          <MiniStat label="Employer NIC" value={fmtMoney(owed_er_nic)} />
          <MiniStat
            label="Paid to HMRC so far"
            value={fmtMoney(paid_hmrc)}
            muted
          />
        </div>
        <p className="mt-4 text-xs text-brand-slate">
          Tip: keep this in a separate pot away from operating cash. When
          HMRC take payment, open the run below and flip status to{' '}
          <strong>Paid</strong> — it drops out of the pot automatically.
        </p>
      </section>

      {/* WAGE BILL */}
      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total gross paid" value={fmtMoney(total_gross)} />
        <Stat label="Total net to bank" value={fmtMoney(total_net)} />
        <Stat label="Runs logged" value={`${list.length}`} />
      </section>

      {/* LIST */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Period</Th>
              <Th>Pay date</Th>
              <Th>Type</Th>
              <Th right>Head</Th>
              <Th right>Gross</Th>
              <Th right>Net</Th>
              <Th right>HMRC</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link
                    href={`/owner/payroll-runs/${r.id}`}
                    className="text-brand-forest hover:text-brand-amber hover:underline"
                  >
                    {r.period_label}
                  </Link>
                </Td>
                <Td>{fmtDate(r.pay_date)}</Td>
                <Td>{r.run_type}</Td>
                <Td right mono>
                  {r.headcount}
                </Td>
                <Td right mono>
                  {fmtMoney(r.total_gross)}
                </Td>
                <Td right mono>
                  {fmtMoney(r.total_net)}
                </Td>
                <Td right mono>
                  {fmtMoney(r.hmrc_due)}
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-sm text-brand-slate"
                >
                  No runs logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

function MiniStat({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div
      className={`rounded-lg bg-white p-3 ${muted ? 'opacity-70' : 'border border-brand-forest/20'}`}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-teal-deep">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold text-brand-forest">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'paid'
      ? 'bg-brand-teal-deep/15 text-brand-teal-deep'
      : status === 'filed'
        ? 'bg-brand-amber/30 text-brand-forest'
        : 'bg-brand-sage/40 text-brand-forest'
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
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
  children?: React.ReactNode
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
