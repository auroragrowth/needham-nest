import Link from 'next/link'
import { createDirectorLoan } from '@/lib/finance/dl-actions'

export default async function NewLoanEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/director-loan"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Director&apos;s loan
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Record DL entry
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createDirectorLoan}
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
              min="0.01"
              required
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
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
            defaultValue="in"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="in">
              Director → Company (loan to company / capital introduced)
            </option>
            <option value="out">
              Company → Director (drawing / loan repayment)
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-brand-forest"
          >
            Description
          </label>
          <input
            id="description"
            name="description"
            type="text"
            placeholder="e.g. Initial capital / Loan repayment"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="reference"
            className="block text-sm font-medium text-brand-forest"
          >
            Reference
          </label>
          <input
            id="reference"
            name="reference"
            type="text"
            placeholder="Bank reference"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Record entry
        </button>
      </form>
    </main>
  )
}
