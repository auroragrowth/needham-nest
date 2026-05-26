import Link from 'next/link'
import { createAppliance } from '../actions'

const KIND_OPTIONS: Array<{
  value: string
  label: string
  hint: string
  min: string
  max: string
}> = [
  {
    value: 'fridge',
    label: 'Fridge',
    hint: 'UK food safety: ≤ 5°C',
    min: '',
    max: '5',
  },
  {
    value: 'freezer',
    label: 'Freezer',
    hint: 'UK food safety: ≤ -18°C',
    min: '',
    max: '-18',
  },
  {
    value: 'hot_hold',
    label: 'Hot hold',
    hint: 'UK food safety: ≥ 63°C',
    min: '63',
    max: '',
  },
  {
    value: 'cold_display',
    label: 'Cold display',
    hint: 'Typically 0°C – 8°C',
    min: '0',
    max: '8',
  },
  {
    value: 'ambient',
    label: 'Ambient',
    hint: 'No statutory range',
    min: '',
    max: '',
  },
]

export default async function NewAppliancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/appliances"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All appliances
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add appliance
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createAppliance}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Name
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Kitchen fridge 1"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="kind"
            className="block text-sm font-medium text-brand-forest"
          >
            Kind
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <select
            id="kind"
            name="kind"
            required
            defaultValue="fridge"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label} — {k.hint}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-brand-slate">
            Pick the kind, then adjust the target range below if needed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="target_min"
              className="block text-sm font-medium text-brand-forest"
            >
              Target min (°C)
            </label>
            <input
              id="target_min"
              name="target_min"
              type="number"
              step="0.1"
              placeholder="—"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label
              htmlFor="target_max"
              className="block text-sm font-medium text-brand-forest"
            >
              Target max (°C)
            </label>
            <input
              id="target_max"
              name="target_max"
              type="number"
              step="0.1"
              placeholder="—"
              defaultValue="5"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-brand-forest"
          >
            Location (optional)
          </label>
          <input
            id="location"
            name="location"
            type="text"
            placeholder="Kitchen / Pass / Backroom"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Add appliance
          </button>
          <Link
            href="/owner/appliances"
            className="rounded-lg border border-brand-sage/60 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  )
}
