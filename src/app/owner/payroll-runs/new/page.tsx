import Link from 'next/link'
import { savePayrollRun } from '@/lib/payroll-runs/actions'

export const dynamic = 'force-dynamic'

export default async function NewPayrollRunPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/payroll-runs"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payroll runs
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Log a payroll run
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Copy the totals from your Sage &quot;Employer&apos;s Summary&quot;
        PDF. Attach the file so it&apos;s on record.
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={savePayrollRun}
        encType="multipart/form-data"
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Run
          </legend>
          <div>
            <label
              htmlFor="run_type"
              className="block text-xs font-medium text-brand-forest"
            >
              Type
            </label>
            <select
              id="run_type"
              name="run_type"
              defaultValue="weekly"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            >
              <option value="weekly">Weekly (staff)</option>
              <option value="monthly">Monthly (Vic / management)</option>
            </select>
          </div>
          <Field
            label="Period label"
            name="period_label"
            placeholder="Wk 13 2026-27"
            required
          />
          <Field label="Pay date" name="pay_date" type="date" required />
          <Field
            label="Headcount"
            name="headcount"
            type="number"
            step="1"
            defaultValue="1"
          />
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="col-span-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Totals (from Employer&apos;s Summary)
          </legend>
          <Field label="Total gross (£)" name="total_gross" type="number" step="0.01" />
          <Field label="Total net (£)" name="total_net" type="number" step="0.01" />
          <Field
            label="Tax deducted (£)"
            name="tax_deducted"
            type="number"
            step="0.01"
          />
          <Field
            label="Employee NIC (£)"
            name="employee_nic"
            type="number"
            step="0.01"
          />
          <Field
            label="Employer NIC (£)"
            name="employer_nic"
            type="number"
            step="0.01"
          />
          <Field
            label="Total HMRC due (£)"
            name="hmrc_due"
            type="number"
            step="0.01"
          />
          <Field
            label="Total net outlay (£)"
            name="total_outlay"
            type="number"
            step="0.01"
          />
          <div>
            <label
              htmlFor="status"
              className="block text-xs font-medium text-brand-forest"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="filed"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            >
              <option value="draft">Draft</option>
              <option value="filed">Filed with HMRC (bill owed)</option>
              <option value="paid">Paid to HMRC (settled)</option>
            </select>
          </div>
        </fieldset>

        <div>
          <label
            htmlFor="notes"
            className="block text-xs font-medium text-brand-forest"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="e.g. Employer NIC covered by Employment Allowance"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </div>

        <div>
          <label
            htmlFor="pdf"
            className="block text-xs font-medium text-brand-forest"
          >
            Attach the Sage PDF (optional)
          </label>
          <input
            id="pdf"
            name="pdf"
            type="file"
            accept="application/pdf"
            className="mt-1 block w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{ minHeight: '44px' }}
        >
          Save run
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
