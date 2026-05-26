import Link from 'next/link'
import { createTakings } from '@/lib/finance/actions'
import { TAKINGS_SOURCES } from '@/lib/finance/constants'

export default async function NewTakingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/takings"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Takings
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Record takings
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createTakings}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-3">
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
              htmlFor="amount"
              className="block text-sm font-medium text-brand-forest"
            >
              Amount (£) <span className="ml-1 text-brand-amber">*</span>
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              required
              inputMode="decimal"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="source"
            className="block text-sm font-medium text-brand-forest"
          >
            Source <span className="ml-1 text-brand-amber">*</span>
          </label>
          <select
            id="source"
            name="source"
            required
            defaultValue="card"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            {TAKINGS_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-brand-forest"
          >
            Description (optional)
          </label>
          <input
            id="description"
            name="description"
            type="text"
            placeholder="e.g. Saturday daily takings"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="reference"
            className="block text-sm font-medium text-brand-forest"
          >
            Reference (optional)
          </label>
          <input
            id="reference"
            name="reference"
            type="text"
            placeholder="SumUp payout ID / batch no."
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Save takings
        </button>
      </form>
    </main>
  )
}
