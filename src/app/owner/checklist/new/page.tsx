import Link from 'next/link'
import { createTask } from '@/lib/checklist/actions'

const FREQ_OPTIONS = [
  { value: 'open', label: 'Opening', hint: 'Before the café opens' },
  { value: 'mid', label: 'Mid-shift', hint: 'During the day' },
  { value: 'close', label: 'Closing', hint: 'After last orders' },
  { value: 'daily', label: 'Daily', hint: 'Anytime during the day' },
]

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/checklist"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All tasks
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add task
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createTask}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Task<span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Wipe down pass, clean fridge handles"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="frequency"
            className="block text-sm font-medium text-brand-forest"
          >
            When<span className="ml-1 text-brand-amber">*</span>
          </label>
          <select
            id="frequency"
            name="frequency"
            required
            defaultValue="daily"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="area"
            className="block text-sm font-medium text-brand-forest"
          >
            Area (optional)
          </label>
          <input
            id="area"
            name="area"
            type="text"
            placeholder="Kitchen / Pass / Front of house / Bathroom"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="sort_order"
            className="block text-sm font-medium text-brand-forest"
          >
            Sort order (optional)
          </label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={0}
            className="mt-1 w-24 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
          <p className="mt-1 text-xs text-brand-slate">
            Lower numbers show first within each group. 0 by default.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Add task
          </button>
          <Link
            href="/owner/checklist"
            className="rounded-lg border border-brand-sage/60 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}
