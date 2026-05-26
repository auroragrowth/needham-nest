import Link from 'next/link'
import { createPayee } from '@/lib/finance/actions'
import { EXPENSE_CATEGORIES } from '@/lib/finance/constants'

export default async function NewPayeePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/payees"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Payees
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add payee
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createPayee}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Name <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="default_category"
            className="block text-sm font-medium text-brand-forest"
          >
            Default category
          </label>
          <select
            id="default_category"
            name="default_category"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="">(none)</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Add payee
        </button>
      </form>
    </main>
  )
}
