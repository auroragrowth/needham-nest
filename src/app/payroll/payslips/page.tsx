import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(n: number | string | null): string {
  if (n == null) return '£0.00'
  return `£${Number(n).toFixed(2)}`
}

export default async function PayrollPayslipsList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const filter = sp.status === 'unpaid' ? 'unpaid' : sp.status === 'paid' ? 'paid' : 'all'

  const admin = createAdminClient()
  let query = admin
    .from('payslips')
    .select(
      'id, staff_id, slip_number, period_from, period_to, pay_date, gross_pay, net_pay, paid_at, paid_method, profiles!inner(name)',
    )
    .order('pay_date', { ascending: false })
    .limit(100)
  if (filter === 'paid') query = query.not('paid_at', 'is', null)
  if (filter === 'unpaid') query = query.is('paid_at', null)

  const { data: payslips } = await query

  type Row = {
    id: string
    staff_id: string
    slip_number: string | null
    period_from: string
    period_to: string
    pay_date: string
    gross_pay: number | string
    net_pay: number | string
    paid_at: string | null
    paid_method: string | null
    profiles: { name: string } | { name: string }[] | null
  }
  const rawRows = (payslips ?? []) as unknown as Row[]
  // Supabase types the join as an array; we joined to a single profile.
  const rows = rawRows.map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles)
      ? (r.profiles[0] ?? null)
      : r.profiles,
  }))

  return (
    <main className="mx-auto max-w-4xl">
      <Link
        href="/payroll"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payroll
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Payslips
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterLink href="/payroll/payslips" label="All" active={filter === 'all'} />
        <FilterLink
          href="/payroll/payslips?status=unpaid"
          label="Unpaid"
          active={filter === 'unpaid'}
        />
        <FilterLink
          href="/payroll/payslips?status=paid"
          label="Paid"
          active={filter === 'paid'}
        />
        <Link
          href="/payroll/payslips/generate"
          className="ml-auto rounded-lg bg-brand-forest px-3 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Generate
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Slip</Th>
              <Th>Staff</Th>
              <Th>Pay date</Th>
              <Th>Period</Th>
              <Th right>Gross</Th>
              <Th right>Net</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <Td mono>
                  <Link
                    href={`/payroll/payslips/${p.id}`}
                    className="text-brand-forest hover:text-brand-amber hover:underline"
                  >
                    {p.slip_number ?? '—'}
                  </Link>
                </Td>
                <Td>{p.profiles?.name ?? '—'}</Td>
                <Td>{fmtDate(p.pay_date)}</Td>
                <Td>
                  {fmtDate(p.period_from)} – {fmtDate(p.period_to)}
                </Td>
                <Td right mono>
                  {fmtMoney(p.gross_pay)}
                </Td>
                <Td right mono>
                  {fmtMoney(p.net_pay)}
                </Td>
                <Td>
                  {p.paid_at ? (
                    <span className="rounded bg-brand-teal-deep/15 px-2 py-0.5 text-xs font-semibold text-brand-teal-deep">
                      ✓ {p.paid_method ?? 'paid'}
                    </span>
                  ) : (
                    <span className="rounded bg-brand-amber/30 px-2 py-0.5 text-xs font-semibold text-brand-forest">
                      unpaid
                    </span>
                  )}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-brand-slate"
                >
                  No payslips match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-1.5 text-sm ${
        active
          ? 'border-brand-forest bg-brand-forest text-brand-cream'
          : 'border-brand-sage/60 text-brand-forest hover:bg-brand-sage/10'
      }`}
    >
      {label}
    </Link>
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
      className={`border-b border-brand-sage/30 px-3 py-2 ${
        right ? 'text-right' : ''
      } ${mono ? 'font-mono text-xs' : 'text-sm'}`}
    >
      {children}
    </td>
  )
}
