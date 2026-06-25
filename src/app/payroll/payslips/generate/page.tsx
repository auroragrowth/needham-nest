import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildStaffPayslip } from '@/lib/staffing/cost'
import { savePayslip } from '@/lib/payslips/actions'

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

export default async function PayrollGeneratePage({
  searchParams,
}: {
  searchParams: Promise<{
    staff?: string
    from?: string
    to?: string
    error?: string
  }>
}) {
  const sp = await searchParams

  // Default to last completed Mon → Sun, pay Friday after.
  const now = new Date()
  const todayMon = startOfMonUTC(now)
  const lastSun = addDays(todayMon, -1)
  const lastMon = addDays(lastSun, -6)
  const payDate = addDays(lastSun, 5) // Fri

  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : isoDate(lastMon)
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : isoDate(lastSun)

  const admin = createAdminClient()
  const { data: staffList } = await admin
    .from('profiles')
    .select('id, name, role, employment_type')
    .eq('active', true)
    .eq('payroll_included', true)
    .neq('role', 'payroll')
    .order('name')

  const staffId = sp.staff && (staffList ?? []).some((s) => s.id === sp.staff)
    ? sp.staff
    : null

  // If a staff member is picked, pre-fill from the timesheet helper.
  const preview = staffId ? await buildStaffPayslip(staffId, from, to) : null

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/payroll/payslips"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payslips
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Generate payslip
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Pick a person and a period (defaults to the last completed
        Mon–Sun, paid the following Friday).
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4">
        <label
          htmlFor="staff"
          className="block text-xs font-medium text-brand-forest"
        >
          Staff
        </label>
        <select
          id="staff"
          name="staff"
          defaultValue={staffId ?? ''}
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
        >
          <option value="" disabled>
            — pick a person —
          </option>
          {(staffList ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.employment_type ?? '—'})
            </option>
          ))}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-3">
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
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
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
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-3 rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Load period
        </button>
      </form>

      {preview && (
        <form
          action={savePayslip.bind(null, staffId!)}
          className="mt-6 space-y-4 rounded-xl border-2 border-brand-amber/60 bg-brand-amber/5 p-5"
        >
          <input type="hidden" name="period_from" value={from} />
          <input type="hidden" name="period_to" value={to} />
          <input
            type="hidden"
            name="pay_date"
            value={isoDate(payDate)}
          />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            {preview.staff_name} · pre-filled from timesheet
          </h2>
          <p className="text-xs text-brand-slate">
            Pay date defaults to {isoDate(payDate)} (Friday after the period
            end). Override the gross or deductions below before saving.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Hours worked"
              name="hours_worked"
              defaultValue={preview.total_hours.toFixed(2)}
              step="0.01"
            />
            <Field
              label="Gross pay (£)"
              name="gross_pay"
              defaultValue={(
                preview.total_gross + preview.paye_total
              ).toFixed(2)}
              step="0.01"
            />
            <Field
              label="Income tax (£)"
              name="tax_deduction"
              defaultValue="0"
              step="0.01"
            />
            <Field
              label="NI (£)"
              name="ni_deduction"
              defaultValue="0"
              step="0.01"
            />
            <Field
              label="Pension (£)"
              name="pension_deduction"
              defaultValue="0"
              step="0.01"
            />
            <Field
              label="Tax code"
              name="tax_code"
              defaultValue=""
              placeholder="1257L"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
            style={{ minHeight: '44px' }}
          >
            Save payslip
          </button>
        </form>
      )}
    </main>
  )
}

function Field({
  label,
  name,
  defaultValue,
  step,
  placeholder,
}: {
  label: string
  name: string
  defaultValue?: string
  step?: string
  placeholder?: string
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
        type="text"
        inputMode={step ? 'decimal' : 'text'}
        step={step}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
      />
    </div>
  )
}
