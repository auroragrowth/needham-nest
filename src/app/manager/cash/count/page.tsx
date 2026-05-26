import Link from 'next/link'
import { recordCashCount } from '@/lib/cash/actions'

export default async function NewCashCountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/manager/cash"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Cash
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        End-of-day count
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Count notes and coins in the till. The expected figure can be left
        blank until SumUp is wired up.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={recordCashCount}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium text-brand-forest"
          >
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="counted"
            className="block text-sm font-medium text-brand-forest"
          >
            Counted (£) <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="counted"
            name="counted"
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-xl text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="expected"
            className="block text-sm font-medium text-brand-forest"
          >
            Expected (£) — optional
          </label>
          <input
            id="expected"
            name="expected"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="From till / SumUp report"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-brand-forest"
          >
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="e.g. £20 short — investigate"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Record count
        </button>
      </form>
    </main>
  )
}
