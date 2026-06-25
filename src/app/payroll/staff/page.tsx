import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtMoney(n: number | string | null): string {
  if (n == null) return '—'
  return `£${Number(n).toFixed(2)}`
}

export default async function PayrollStaffList() {
  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('profiles')
    .select(
      'id, name, role, employment_type, hourly_rate, annual_salary, ni_number, tax_code, bank_sort_code, bank_account_number',
    )
    .eq('active', true)
    .eq('payroll_included', true)
    .neq('role', 'payroll')
    .order('role')
    .order('name')

  return (
    <main className="mx-auto max-w-5xl">
      <Link
        href="/payroll"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payroll
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Staff details
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Everything you need to set someone up on payroll. Tap a row for
        full personal details.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th right>Rate</Th>
              <Th>NI</Th>
              <Th>Tax code</Th>
              <Th>Sort code</Th>
              <Th>Account</Th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link
                    href={`/payroll/staff/${s.id}`}
                    className="text-brand-forest hover:text-brand-amber hover:underline"
                  >
                    {s.name}
                  </Link>{' '}
                  <span className="text-[10px] uppercase text-brand-slate">
                    {s.role}
                  </span>
                </Td>
                <Td>
                  {s.employment_type === 'paye'
                    ? 'PAYE'
                    : s.employment_type === 'casual'
                      ? 'Casual'
                      : s.employment_type ?? '—'}
                </Td>
                <Td right mono>
                  {s.employment_type === 'paye'
                    ? `${fmtMoney(s.annual_salary)}/yr`
                    : `${fmtMoney(s.hourly_rate)}/h`}
                </Td>
                <Td mono>{s.ni_number ?? '—'}</Td>
                <Td mono>{s.tax_code ?? '—'}</Td>
                <Td mono>{s.bank_sort_code ?? '—'}</Td>
                <Td mono>{s.bank_account_number ?? '—'}</Td>
              </tr>
            ))}
            {(staff?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-sm text-brand-slate"
                >
                  No active staff.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
      className={`border-b border-brand-sage/30 px-3 py-2 ${
        right ? 'text-right' : ''
      } ${mono ? 'font-mono text-xs' : 'text-sm'}`}
    >
      {children}
    </td>
  )
}
