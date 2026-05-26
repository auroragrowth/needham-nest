import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deactivateAppliance,
  reactivateAppliance,
  updateAppliance,
} from '../actions'

const KIND_OPTIONS = [
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'hot_hold', label: 'Hot hold' },
  { value: 'cold_display', label: 'Cold display' },
  { value: 'ambient', label: 'Ambient' },
]

export default async function EditAppliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()

  const { data: a } = await admin
    .from('appliances')
    .select('id, name, kind, target_min, target_max, location, active')
    .eq('id', id)
    .maybeSingle()

  if (!a) notFound()

  const action = updateAppliance.bind(null, id)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/appliances"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All appliances
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {a.name}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {a.active ? 'Active' : 'Inactive'} ·{' '}
        {KIND_OPTIONS.find((k) => k.value === a.kind)?.label ?? a.kind}
      </p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={a.name}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="kind"
            className="block text-sm font-medium text-brand-forest"
          >
            Kind
          </label>
          <select
            id="kind"
            name="kind"
            required
            defaultValue={a.kind}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
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
              defaultValue={a.target_min ?? ''}
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
              defaultValue={a.target_max ?? ''}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-brand-forest"
          >
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={a.location ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Save changes
        </button>
      </form>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          {a.active ? 'Deactivate' : 'Reactivate'}
        </h2>
        <p className="mt-1 text-sm text-brand-slate">
          {a.active
            ? 'Hides this appliance from the staff log screen. Past logs are preserved.'
            : 'Brings the appliance back to the staff log screen.'}
        </p>
        <form
          action={
            a.active
              ? deactivateAppliance.bind(null, id)
              : reactivateAppliance.bind(null, id)
          }
          className="mt-3"
        >
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              a.active
                ? 'border border-brand-amber/60 bg-brand-amber/10 text-brand-forest hover:bg-brand-amber/20'
                : 'bg-brand-teal-deep text-brand-cream hover:bg-brand-teal'
            }`}
          >
            {a.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </form>
      </section>
    </main>
  )
}
