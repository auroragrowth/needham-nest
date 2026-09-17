type Defaults = {
  name?: string | null
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  account_number?: string | null
  payment_terms?: string | null
  delivery_days?: string[] | null
  minimum_order?: number | null
  notes?: string | null
}

export function SupplierForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>
  defaults?: Defaults
  submitLabel: string
}) {
  return (
    <form
      action={action}
      className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
    >
      <Field
        label="Name"
        name="name"
        required
        defaultValue={defaults.name ?? ''}
        placeholder="e.g. Bookers / Bidfood / local farm"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Contact name"
          name="contact_name"
          defaultValue={defaults.contact_name ?? ''}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={defaults.email ?? ''}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Phone"
          name="phone"
          defaultValue={defaults.phone ?? ''}
        />
        <Field
          label="Account number"
          name="account_number"
          defaultValue={defaults.account_number ?? ''}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Delivery days"
          name="delivery_days"
          defaultValue={(defaults.delivery_days ?? []).join(', ')}
          placeholder="Mon, Wed, Fri"
        />
        <Field
          label="Minimum order (£)"
          name="minimum_order"
          type="number"
          step="0.01"
          defaultValue={defaults.minimum_order?.toString() ?? ''}
        />
      </div>
      <Field
        label="Payment terms"
        name="payment_terms"
        defaultValue={defaults.payment_terms ?? ''}
        placeholder="Net 7 / Net 30 / On delivery"
      />
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
