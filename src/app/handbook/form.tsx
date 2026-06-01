export const SUGGESTED_CATEGORIES = [
  'Food crib sheets',
  'Machine crib sheets',
  'Machine care & cleaning',
  'Drinks recipes',
  'Front of house',
  'Allergens',
  'Opening / closing',
  'Health & safety',
  'Onboarding',
]

type Defaults = {
  title?: string | null
  category?: string | null
  body?: string | null
  sort_order?: number | null
}

export function HandbookForm({
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
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-brand-forest"
        >
          Title <span className="ml-1 text-brand-amber">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={defaults.title ?? ''}
          placeholder="e.g. How to make a flat white"
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-brand-forest"
        >
          Category
        </label>
        <input
          id="category"
          name="category"
          type="text"
          list="handbook-category-suggestions"
          defaultValue={defaults.category ?? ''}
          placeholder="Food crib sheets / Machine care / …"
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
        <datalist id="handbook-category-suggestions">
          {SUGGESTED_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="mt-1 text-xs text-brand-slate">
          Articles with the same category get grouped together on the
          Handbook list. Start typing for suggestions.
        </p>
      </div>

      <div>
        <label
          htmlFor="body"
          className="block text-sm font-medium text-brand-forest"
        >
          Body
        </label>
        <textarea
          id="body"
          name="body"
          rows={16}
          defaultValue={defaults.body ?? ''}
          placeholder={
            "Write the manual / crib sheet here.\n\nLine breaks are preserved.\nUse blank lines between paragraphs."
          }
          className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 font-mono text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
      </div>

      <div>
        <label
          htmlFor="sort_order"
          className="block text-sm font-medium text-brand-forest"
        >
          Sort order (within category)
        </label>
        <input
          id="sort_order"
          name="sort_order"
          type="number"
          defaultValue={defaults.sort_order ?? 0}
          className="mt-1 w-24 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
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
