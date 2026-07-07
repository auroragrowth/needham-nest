import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  markPayslipPaid,
  unmarkPayslipPaid,
} from '@/lib/payslips/actions'

export const dynamic = 'force-dynamic'

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return '£0.00'
  return `£${Number(n).toFixed(2)}`
}

export default async function PayrollPayslipView({
  params,
}: {
  params: Promise<{ payslipId: string }>
}) {
  const { payslipId } = await params

  const admin = createAdminClient()
  const { data: payslip } = await admin
    .from('payslips')
    .select('*')
    .eq('id', payslipId)
    .maybeSingle()
  if (!payslip) notFound()

  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, name, address_line_1, address_line_2, address_city, address_postcode, ni_number, bank_sort_code, bank_account_number',
    )
    .eq('id', payslip.staff_id)
    .maybeSingle()

  if (!profile) notFound()

  const totalDeductions =
    Number(payslip.tax_deduction) +
    Number(payslip.ni_deduction) +
    Number(payslip.pension_deduction) +
    Number(payslip.other_deductions)

  const markPaid = markPayslipPaid.bind(null, profile.id, payslipId)
  const unmark = unmarkPayslipPaid.bind(null, profile.id, payslipId)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/payroll/payslips"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payslips
      </Link>
      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-forest">
            Payslip {payslip.slip_number ?? ''}
          </h1>
          <p className="text-xs text-brand-slate">
            {profile.name} · pay date {fmtDate(payslip.pay_date)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {payslip.paid_at ? (
            <form action={unmark}>
              <button
                type="submit"
                className="rounded-lg bg-brand-teal-deep/15 px-3 py-1.5 text-sm font-semibold text-brand-teal-deep hover:bg-brand-teal-deep/25"
              >
                ✓ Paid · undo
              </button>
            </form>
          ) : (
            <form action={markPaid} className="flex gap-1">
              <select
                name="paid_method"
                className="rounded-md border border-brand-sage/60 bg-white px-2 py-1.5 text-xs"
              >
                <option value="BACS">BACS</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-brand-amber px-3 py-1.5 text-sm font-semibold text-brand-forest"
              >
                Mark paid
              </button>
            </form>
          )}
          <a
            href={`/owner/payslips/${profile.id}/${payslipId}/pdf`}
            download
            className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-brand-cream hover:bg-brand-teal-deep"
          >
            Download PDF
          </a>
        </div>
      </header>

      <article className="mt-6 rounded-xl border-2 border-brand-forest/30 bg-white p-6">
        <section className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Employee
            </p>
            <p className="mt-1 font-semibold">{profile.name}</p>
            <p className="text-xs text-brand-slate">
              {[
                profile.address_line_1,
                profile.address_line_2,
                profile.address_city,
                profile.address_postcode,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
          <div className="text-right text-xs">
            {payslip.tax_code && (
              <p>
                <span className="text-brand-slate">Tax code:</span>{' '}
                <span className="font-mono">{payslip.tax_code}</span>
              </p>
            )}
            {profile.ni_number && (
              <p>
                <span className="text-brand-slate">NI number:</span>{' '}
                <span className="font-mono">{profile.ni_number}</span>
              </p>
            )}
            <p>
              <span className="text-brand-slate">Hours:</span>{' '}
              <span className="font-mono">
                {Number(payslip.hours_worked).toFixed(2)}
              </span>
            </p>
            {(profile.bank_sort_code || profile.bank_account_number) && (
              <>
                <p className="mt-1">
                  <span className="text-brand-slate">Sort code:</span>{' '}
                  <span className="font-mono">
                    {profile.bank_sort_code ?? '—'}
                  </span>
                </p>
                <p>
                  <span className="text-brand-slate">Account:</span>{' '}
                  <span className="font-mono">
                    {profile.bank_account_number ?? '—'}
                  </span>
                </p>
              </>
            )}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Earnings
            </h3>
            <Row label="Gross pay" value={fmtMoney(payslip.gross_pay)} />
            <Row
              label="Total"
              value={fmtMoney(payslip.gross_pay)}
              border
              bold
            />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Deductions
            </h3>
            <Row label="Income tax" value={fmtMoney(payslip.tax_deduction)} />
            <Row label="NI" value={fmtMoney(payslip.ni_deduction)} />
            <Row label="Pension" value={fmtMoney(payslip.pension_deduction)} />
            {Number(payslip.other_deductions) > 0 && (
              <Row
                label={payslip.other_deductions_label ?? 'Other'}
                value={fmtMoney(payslip.other_deductions)}
              />
            )}
            <Row
              label="Total"
              value={fmtMoney(totalDeductions)}
              border
              bold
            />
          </div>
        </section>

        <section className="mt-6 flex items-baseline justify-between rounded-lg border-2 border-brand-forest/40 bg-brand-amber/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Net pay
          </p>
          <p className="text-2xl font-semibold text-brand-forest">
            {fmtMoney(payslip.net_pay)}
          </p>
        </section>
      </article>
    </main>
  )
}

function Row({
  label,
  value,
  border,
  bold,
}: {
  label: string
  value: string
  border?: boolean
  bold?: boolean
}) {
  return (
    <div
      className={`flex justify-between py-1 ${border ? 'border-t border-brand-sage/40 mt-1 pt-1' : ''} ${bold ? 'font-semibold' : ''}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
