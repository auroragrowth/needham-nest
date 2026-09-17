type Defaults = {
  sku?: string | null
  name?: string | null
  category?: string | null
  unit?: string | null
  par_level?: number | null
  reorder_at?: number | null
  cost_price?: number | null
  supplier_name?: string | null
}

export function StockForm({
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
        placeholder="e.g. Whole milk 1L"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="SKU (optional)"
          name="sku"
          defaultValue={defaults.sku ?? ''}
          placeholder="MILK-W-1L"
        />
        <Field
          label="Category"
          name="category"
          defaultValue={defaults.category ?? ''}
          placeholder="Dairy / Coffee / Pastries"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field
          label="Unit"
          name="unit"
          defaultValue={defaults.unit ?? 'ea'}
          placeholder="ea / kg / L"
        />
        <Field
          label="Par level"
          name="par_level"
          type="number"
          step="0.01"
          defaultValue={defaults.par_level?.toString() ?? ''}
        />
        <Field
          label="Reorder at"
          name="reorder_at"
          type="number"
          step="0.01"
          defaultValue={defaults.reorder_at?.toString() ?? ''}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Cost (£)"
          name="cost_price"
          type="number"
          step="0.01"
          defaultValue={defaults.cost_price?.toString() ?? ''}
        />
        <Field
          label="Supplier"
          name="supplier_name"
          defaultValue={defaults.supplier_name ?? ''}
          placeholder="Bookers / Bidfood"
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
