import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildStaffPayslip } from '@/lib/staffing/cost'
import { createAdminClient } from '@/lib/supabase/admin'
import { savePayslip } from '@/lib/payslips/actions'

export const dynamic = 'force-dynamic'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function GeneratePayslipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const today = isoDate(new Date())
  const monthStart = today.slice(0, 7) + '-01'
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : monthStart
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today

  const admin = createAdminClient()
  const [{ data: profile }, payslipData] = await Promise.all([
    admin
      .from('profiles')
      .select('id, name, employment_type, annual_salary, hourly_rate')
      .eq('id', id)
      .maybeSingle(),
    buildStaffPayslip(id, from, to),
  ])
  if (!profile || !payslipData) notFound()

  const isPaye = profile.employment_type === 'paye'
  const grossHourly = payslipData.total_gross
  const grossPaye = payslipData.paye_total
  const totalGross = isPaye ? grossPaye + grossHourly : grossHourly

  const save = savePayslip.bind(null, id)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href={`/owner/payslips/${id}`}
        className="text-sm text-brand-amber hover:underline"
      >
        ← {profile.name}&apos;s timesheet
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Generate payslip
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {profile.name} · {isPaye ? 'PAYE' : 'Casual / hourly'}
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={save}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Period
          </legend>
          <Field
            label="From"
            name="period_from"
            type="date"
            defaultValue={from}
            required
          />
          <Field
            label="To"
            name="period_to"
            type="date"
            defaultValue={to}
            required
          />
          <Field
            label="Pay date"
            name="pay_date"
            type="date"
            defaultValue={today}
            required
          />
          <Field
            label="Tax code"
            name="tax_code"
            placeholder="1257L"
          />
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Earnings (pre-filled from timesheet)
          </legend>
          <Field
            label="Hours worked"
            name="hours_worked"
            type="number"
            step="0.01"
            defaultValue={payslipData.total_hours.toFixed(2)}
          />
          <Field
            label="Gross pay (£)"
            name="gross_pay"
            type="number"
            step="0.01"
            defaultValue={totalGross.toFixed(2)}
          />
          {isPaye && (
            <p className="col-span-2 text-xs text-brand-slate">
              PAYE salary share for the period: £{grossPaye.toFixed(2)}
              {grossHourly > 0 &&
                ` + £${grossHourly.toFixed(2)} additional clocked hours`}
            </p>
          )}
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Deductions
          </legend>
          <Field
            label="Income tax (£)"
            name="tax_deduction"
            type="number"
            step="0.01"
            defaultValue="0"
          />
          <Field
            label="NI (£)"
            name="ni_deduction"
            type="number"
            step="0.01"
            defaultValue="0"
          />
          <Field
            label="Pension (£)"
            name="pension_deduction"
            type="number"
            step="0.01"
            defaultValue="0"
          />
          <Field
            label="NI category"
            name="ni_category"
            defaultValue="A"
          />
          <Field
            label="Other deductions (£)"
            name="other_deductions"
            type="number"
            step="0.01"
            defaultValue="0"
          />
          <Field
            label="Other label"
            name="other_deductions_label"
            placeholder="e.g. Salary sacrifice"
          />
          <p className="col-span-2 text-xs text-brand-slate">
            Get the exact tax / NI figures from your payroll software
            (HMRC Basic PAYE Tools or similar). This page records what
            you actually paid — net is auto-calculated below.
          </p>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Notes (optional)
          </legend>
          <textarea
            name="notes"
            rows={2}
            placeholder="e.g. Includes one bank holiday"
            className="mt-2 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{ minHeight: '44px' }}
        >
          Save payslip
        </button>
      </form>
    </main>
  )
}

function Field({
  label,
  name,
  type = 'text',
  step,
  defaultValue,
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  step?: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs font-medium text-brand-forest"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
        style={{ minHeight: '40px' }}
      />
    </div>
  )
}
