import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

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

function formatRelative(date: Date, now: Date): string {
  const ms = now.getTime() - date.getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default async function TemperaturesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  await requireStaffFeature('temperatures')
  const params = await searchParams
  const admin = createAdminClient()
  const now = new Date()

  const { data: appliances } = await admin
    .from('appliances')
    .select('id, name, kind, target_min, target_max, location')
    .eq('active', true)
    .order('kind')
    .order('name')

  const { data: todaysLogs } = await admin
    .from('temperature_logs')
    .select('appliance_id, temperature, in_range, recorded_at')
    .gte('recorded_at', startOfTodayIso())
    .order('recorded_at', { ascending: false })

  // Latest log per appliance for today
  const latestByAppliance = new Map<
    string,
    { temperature: number; in_range: boolean; recorded_at: string }
  >()
  for (const l of todaysLogs ?? []) {
    if (!latestByAppliance.has(l.appliance_id)) {
      latestByAppliance.set(l.appliance_id, {
        temperature: l.temperature,
        in_range: l.in_range,
        recorded_at: l.recorded_at,
      })
    }
  }

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Temperatures
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Tap an appliance to log its current temperature.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {(appliances ?? []).length === 0 && (
          <li className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No appliances configured yet. Ask the owner to add them.
          </li>
        )}
        {(appliances ?? []).map((a) => {
          const latest = latestByAppliance.get(a.id)
          return (
            <li key={a.id}>
              <Link
                href={`/staff/temperatures/${a.id}`}
                className={`block rounded-2xl border p-4 transition active:scale-[0.98] ${
                  latest
                    ? latest.in_range
                      ? 'border-brand-teal/40 bg-brand-teal/5'
                      : 'border-brand-amber/60 bg-brand-amber/10'
                    : 'border-brand-sage/40 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-brand-forest">
                      {a.name}
                    </p>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-brand-slate">
                      {KIND_LABEL[a.kind] ?? a.kind}
                      {a.location ? ` · ${a.location}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-brand-slate">
                      Target {formatTarget(a.target_min, a.target_max)}
                    </p>
                  </div>
                  <div className="text-right">
                    {latest ? (
                      <>
                        <p
                          className={`text-xl font-semibold ${
                            latest.in_range
                              ? 'text-brand-teal-deep'
                              : 'text-brand-amber'
                          }`}
                        >
                          {latest.temperature}°C
                        </p>
                        <p className="text-xs text-brand-slate">
                          {formatRelative(new Date(latest.recorded_at), now)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs font-medium text-brand-amber">
                        Not logged today
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
