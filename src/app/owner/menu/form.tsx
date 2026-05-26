import { COMMON_ALLERGENS, type RecipeLine } from '@/lib/menu'

const RECIPE_ROWS = 8

type StockOption = {
  id: string
  name: string
  unit: string
}

type Defaults = {
  name?: string | null
  category?: string | null
  description?: string | null
  sell_price?: number | null
  cost_price_override?: number | null
  recipe?: RecipeLine[] | null
  allergens?: string[] | null
}

export function MenuItemForm({
  action,
  defaults = {},
  stockOptions,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>
  defaults?: Defaults
  stockOptions: StockOption[]
  submitLabel: string
}) {
  const recipe = defaults.recipe ?? []
  const allergens = new Set(defaults.allergens ?? [])

  return (
    <form
      action={action}
      className="mt-6 space-y-6 rounded-xl border border-brand-sage/40 bg-white p-6"
    >
      <Field
        label="Name"
        name="name"
        required
        defaultValue={defaults.name ?? ''}
        placeholder="e.g. Flat White"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Category"
          name="category"
          defaultValue={defaults.category ?? ''}
          placeholder="Drinks / Food / Pastries"
        />
        <Field
          label="Sell price (£)"
          name="sell_price"
          type="number"
          step="0.01"
          required
          defaultValue={defaults.sell_price?.toString() ?? '0'}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-brand-forest"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaults.description ?? ''}
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Recipe
        </legend>
        <p className="mt-1 text-xs text-brand-slate">
          Pick stock items and quantities. Cost is computed from each item&apos;s
          cost price.
        </p>
        <div className="mt-3 space-y-2">
          {Array.from({ length: RECIPE_ROWS }, (_, i) => {
            const line = recipe[i]
            return (
              <div key={i} className="grid grid-cols-6 gap-2">
                <select
                  name={`recipe_${i}_item`}
                  defaultValue={line?.stock_item_id ?? ''}
                  className="col-span-4 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                >
                  <option value="">(none)</option>
                  {stockOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (per {s.unit})
                    </option>
                  ))}
                </select>
                <input
                  name={`recipe_${i}_qty`}
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Qty"
                  defaultValue={line?.quantity?.toString() ?? ''}
                  className="col-span-2 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-right text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                />
              </div>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="cost_price_override"
          className="block text-sm font-medium text-brand-forest"
        >
          Cost override (£) — optional
        </label>
        <input
          id="cost_price_override"
          name="cost_price_override"
          type="number"
          step="0.01"
          defaultValue={defaults.cost_price_override?.toString() ?? ''}
          placeholder="Leave blank to use recipe cost"
          className="mt-1 w-40 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
      </div>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Allergens
        </legend>
        <p className="mt-1 text-xs text-brand-slate">
          Tick all that apply. Used in the printable allergen sheet and EHO pack.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {COMMON_ALLERGENS.map((a) => (
            <label
              key={a}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-brand-sage/40 px-3 py-2 text-sm capitalize hover:bg-brand-sage/5"
            >
              <input
                type="checkbox"
                name={`allergen_${a}`}
                defaultChecked={allergens.has(a)}
                className="h-4 w-4 rounded border-brand-sage/60 accent-brand-teal-deep"
              />
              <span className="text-brand-forest">{a}</span>
            </label>
          ))}
        </div>
      </fieldset>

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
