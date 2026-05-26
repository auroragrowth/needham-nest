import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { logTemperature } from '@/lib/temperatures/actions'

const KIND_LABEL: Record<string, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  hot_hold: 'Hot hold',
  cold_display: 'Cold display',
  ambient: 'Ambient',
}

function formatTarget(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}°C – ${max}°C`
  if (max != null) return `≤ ${max}°C`
  if (min != null) return `≥ ${min}°C`
  return 'No target set'
}

export default async function LogTemperaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; t?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()

  const { data: appliance } = await admin
    .from('appliances')
    .select('id, name, kind, target_min, target_max, location, active')
    .eq('id', id)
    .maybeSingle()

  if (!appliance) notFound()

  const { data: recent } = await admin
    .from('temperature_logs')
    .select('id, temperature, in_range, recorded_at, corrective_action')
    .eq('appliance_id', id)
    .order('recorded_at', { ascending: false })
    .limit(3)

  const action = logTemperature.bind(null, id)
  const lastTemp = sp.t ?? ''

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff/temperatures"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All appliances
      </Link>

      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {appliance.name}
      </h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-brand-slate">
        {KIND_LABEL[appliance.kind] ?? appliance.kind}
        {appliance.location ? ` · ${appliance.location}` : ''}
      </p>
      <p className="mt-1 text-sm text-brand-slate">
        Target {formatTarget(appliance.target_min, appliance.target_max)}
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-5"
      >
        <div>
          <label
            htmlFor="temperature"
            className="block text-sm font-medium text-brand-forest"
          >
            Temperature (°C)
          </label>
          <input
            id="temperature"
            name="temperature"
            type="number"
            step="0.1"
            min={-40}
            max={150}
            required
            defaultValue={lastTemp}
            inputMode="decimal"
            autoFocus
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-2xl text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-brand-forest"
          >
            Notes (optional)
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="corrective_action"
            className="block text-sm font-medium text-brand-forest"
          >
            Corrective action
          </label>
          <p className="mt-0.5 text-xs text-brand-slate">
            Required if the temperature is outside the target range — e.g.
            &quot;adjusted thermostat&quot;, &quot;moved stock to other unit&quot;.
          </p>
          <input
            id="corrective_action"
            name="corrective_action"
            type="text"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-brand-forest px-6 py-4 text-lg font-semibold text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive"
        >
          Log temperature
        </button>
      </form>

      {(recent ?? []).length > 0 && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-slate">
            Recent logs
          </h2>
          <ul className="mt-2 divide-y divide-brand-sage/30 text-sm">
            {(recent ?? []).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="text-brand-forest">
                    {new Date(r.recorded_at).toLocaleString([], {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {r.corrective_action && (
                    <p className="text-xs text-brand-amber">
                      {r.corrective_action}
                    </p>
                  )}
                </div>
                <span
                  className={`font-mono ${
                    r.in_range ? 'text-brand-teal-deep' : 'text-brand-amber'
                  }`}
                >
                  {r.temperature}°C
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
