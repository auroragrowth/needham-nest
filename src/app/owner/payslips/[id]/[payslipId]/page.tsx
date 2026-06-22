import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '../PrintButton'
import {
  deletePayslip,
  markPayslipPaid,
  unmarkPayslipPaid,
} from '@/lib/payslips/actions'

export const dynamic = 'force-dynamic'

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMoney(n: number | string | null | undefined): string {
  if (n == null) return '£0.00'
  return `£${Number(n).toFixed(2)}`
}

export default async function PayslipView({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>
}) {
  const { id, payslipId } = await params

  const admin = createAdminClient()
  const [{ data: payslip }, { data: profile }, { data: settings }] =
    await Promise.all([
      admin
        .from('payslips')
        .select('*')
        .eq('id', payslipId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select(
          'id, name, address_line_1, address_line_2, address_city, address_postcode, ni_number, employment_type, bank_sort_code, bank_account_number',
        )
        .eq('id', id)
        .maybeSingle(),
      admin
        .from('settings')
        .select('company_name, address')
        .limit(1)
        .maybeSingle(),
    ])

  if (!payslip || !profile) notFound()

  const del = deletePayslip.bind(null, id, payslipId)
  const markPaid = markPayslipPaid.bind(null, id, payslipId)
  const unmark = unmarkPayslipPaid.bind(null, id, payslipId)

  const totalDeductions =
    Number(payslip.tax_deduction) +
    Number(payslip.ni_deduction) +
    Number(payslip.pension_deduction) +
    Number(payslip.other_deductions)

  return (
    <main className="mx-auto max-w-2xl print:max-w-none">
      {/* Force the printed page to A5 portrait. The @page rule has to
          live in a real <style> tag (Tailwind can't emit it). */}
      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 10mm; }
          html, body { background: white; }
          main { padding: 0 !important; }
          article { font-size: 10pt; }
          article h1, article h2, article h3 { font-size: 11pt; }
        }
      `}</style>
      <Link
        href={`/owner/payslips/${id}`}
        className="text-sm text-brand-amber hover:underline print:hidden"
      >
        ← {profile.name}&apos;s timesheet
      </Link>

      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-forest">
            Payslip {payslip.slip_number ?? ''}
          </h1>
          <p className="text-xs text-brand-slate">
            Paid {fmtDate(payslip.pay_date)} · {profile.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {payslip.paid_at ? (
            <form action={unmark}>
              <button
                type="submit"
                className="rounded-lg bg-brand-teal-deep/15 px-3 py-1.5 text-sm font-semibold text-brand-teal-deep hover:bg-brand-teal-deep/25"
                title={`Paid ${fmtDate(payslip.paid_at.slice(0, 10))} via ${payslip.paid_method ?? '—'}. Click to undo.`}
              >
                ✓ Paid · undo
              </button>
            </form>
          ) : (
            <form action={markPaid} className="flex gap-1">
              <select
                name="paid_method"
                className="rounded-md border border-brand-sage/60 bg-white px-2 py-1.5 text-xs text-brand-forest"
              >
                <option value="BACS">BACS</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Director loan">Director loan</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-brand-amber px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
              >
                Mark paid
              </button>
            </form>
          )}
          <Link
            href={`/owner/payslips/${id}/generate?from=${payslip.period_from}&to=${payslip.period_to}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            Edit
          </Link>
          <PrintButton />
          <form action={del}>
            <button
              type="submit"
              className="rounded-lg border border-brand-amber/60 px-3 py-1.5 text-sm text-brand-amber hover:bg-brand-amber/10"
            >
              Delete
            </button>
          </form>
        </div>
      </header>

      <article className="mt-6 rounded-xl border-2 border-brand-forest/30 bg-white p-6 print:border-0 print:p-0">
        {/* Header */}
        <header className="border-b border-brand-sage/40 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                Employer
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-forest">
                {settings?.company_name ?? 'The Needham Nest'}
              </p>
              <p className="whitespace-pre-line text-xs text-brand-slate">
                {settings?.address ?? 'Unit 2, The Old Town Hall'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                Payslip
              </p>
              {payslip.slip_number && (
                <p className="mt-1 font-mono text-sm font-semibold text-brand-forest">
                  {payslip.slip_number}
                </p>
              )}
              <p className="text-xs text-brand-slate">
                Pay date {fmtDate(payslip.pay_date)}
              </p>
              <p className="text-xs text-brand-slate">
                Period {fmtDate(payslip.period_from)} – {fmtDate(payslip.period_to)}
              </p>
              {payslip.paid_at && (
                <p className="mt-1 text-xs font-semibold text-brand-teal-deep">
                  ✓ Paid {fmtDate(payslip.paid_at.slice(0, 10))}
                  {payslip.paid_method && ` · ${payslip.paid_method}`}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Employee */}
        <section className="mt-4 grid grid-cols-2 gap-4 border-b border-brand-sage/40 pb-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Employee
            </p>
            <p className="mt-1 font-semibold text-brand-forest">
              {profile.name}
            </p>
            {(profile.address_line_1 ||
              profile.address_city ||
              profile.address_postcode) && (
              <p className="text-xs text-brand-slate">
                {profile.address_line_1}
                {profile.address_line_2 && `, ${profile.address_line_2}`}
                {profile.address_city && `, ${profile.address_city}`}
                {profile.address_postcode && ` ${profile.address_postcode}`}
              </p>
            )}
          </div>
          <div className="text-right text-xs">
            {payslip.tax_code && (
              <p>
                <span className="text-brand-slate">Tax code:</span>{' '}
                <span className="font-mono">{payslip.tax_code}</span>
              </p>
            )}
            {payslip.ni_category && (
              <p>
                <span className="text-brand-slate">NI category:</span>{' '}
                <span className="font-mono">{payslip.ni_category}</span>
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

        {/* Earnings + Deductions */}
        <section className="mt-4 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Earnings
            </h3>
            <table className="mt-2 w-full">
              <tbody>
                <tr>
                  <td className="py-1">Gross pay</td>
                  <td className="py-1 text-right font-mono">
                    {fmtMoney(payslip.gross_pay)}
                  </td>
                </tr>
                <tr className="border-t border-brand-sage/40">
                  <td className="py-1 font-semibold">Total earnings</td>
                  <td className="py-1 text-right font-mono font-semibold">
                    {fmtMoney(payslip.gross_pay)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Deductions
            </h3>
            <table className="mt-2 w-full">
              <tbody>
                <tr>
                  <td className="py-1">Income tax</td>
                  <td className="py-1 text-right font-mono">
                    {fmtMoney(payslip.tax_deduction)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">National Insurance</td>
                  <td className="py-1 text-right font-mono">
                    {fmtMoney(payslip.ni_deduction)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1">Pension</td>
                  <td className="py-1 text-right font-mono">
                    {fmtMoney(payslip.pension_deduction)}
                  </td>
                </tr>
                {Number(payslip.other_deductions) > 0 && (
                  <tr>
                    <td className="py-1">
                      {payslip.other_deductions_label ?? 'Other'}
                    </td>
                    <td className="py-1 text-right font-mono">
                      {fmtMoney(payslip.other_deductions)}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-brand-sage/40">
                  <td className="py-1 font-semibold">Total deductions</td>
                  <td className="py-1 text-right font-mono font-semibold">
                    {fmtMoney(totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Net */}
        <section className="mt-6 rounded-lg border-2 border-brand-forest/40 bg-brand-amber/10 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Net pay this period
            </p>
            <p className="text-2xl font-semibold text-brand-forest">
              {fmtMoney(payslip.net_pay)}
            </p>
          </div>
        </section>

        {payslip.notes && (
          <p className="mt-4 text-xs text-brand-slate">{payslip.notes}</p>
        )}

        <footer className="mt-6 border-t border-brand-sage/40 pt-3 text-[10px] text-brand-slate">
          Generated {fmtDate(payslip.created_at.slice(0, 10))} · This is a
          payroll summary for record-keeping; the legal payslip is issued by
          your PAYE software.
        </footer>
      </article>
    </main>
  )
}
