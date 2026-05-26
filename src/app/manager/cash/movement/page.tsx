import Link from 'next/link'
import { recordCashMovement } from '@/lib/cash/actions'

export default async function NewCashMovementPage({
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
        Petty cash movement
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Float top-ups, withdrawals, or cash spend outside the till.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={recordCashMovement}
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
            htmlFor="direction"
            className="block text-sm font-medium text-brand-forest"
          >
            Direction <span className="ml-1 text-brand-amber">*</span>
          </label>
          <select
            id="direction"
            name="direction"
            required
            defaultValue="out"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="out">Out — money leaving the float</option>
            <option value="in">In — money topping up the float</option>
          </select>
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
            min="0.01"
            required
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-brand-forest"
          >
            Reason <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            required
            placeholder="e.g. Bought milk from corner shop"
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
            placeholder="Receipt number / invoice ref"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Record movement
        </button>
      </form>
    </main>
  )
}
