import { EXPENSE_CATEGORIES } from '@/lib/finance/constants'

type Defaults = {
  date?: string | null
  category?: string | null
  vendor?: string | null
  amount?: number | null
  payment_method?: string | null
  reference?: string | null
  notes?: string | null
}

export function ExpenseForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>
  defaults?: Defaults
  submitLabel: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <form
      action={action}
      className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Date"
          name="date"
          type="date"
          defaultValue={defaults.date ?? today}
        />
        <Field
          label="Amount (£)"
          name="amount"
          type="number"
          step="0.01"
          required
          defaultValue={defaults.amount?.toString() ?? ''}
        />
      </div>

      <Field
        label="Vendor"
        name="vendor"
        required
        defaultValue={defaults.vendor ?? ''}
        placeholder="e.g. Bookers / Tesco / British Gas"
      />
      <p className="-mt-3 text-xs text-brand-slate">
        First time you use a vendor it&apos;s saved as a payee for next time.
      </p>

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-brand-forest"
        >
          Category <span className="ml-1 text-brand-amber">*</span>
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue={defaults.category ?? 'food_purchases'}
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Payment method"
          name="payment_method"
          defaultValue={defaults.payment_method ?? ''}
          placeholder="Card / cash / DD"
        />
        <Field
          label="Reference"
          name="reference"
          defaultValue={defaults.reference ?? ''}
          placeholder="Receipt / invoice no."
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-brand-forest"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes ?? ''}
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
      >
        {submitLabel}
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  step,
  required,
  defaultValue,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  step?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-brand-forest"
      >
        {label}
        {required && <span className="ml-1 text-brand-amber">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
      />
    </div>
  )
}
