import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

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
  return '—'
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

type Log = {
  id: string
  appliance_id: string
  temperature: number
  in_range: boolean
  recorded_at: string
  corrective_action: string | null
  notes: string | null
  user_id: string
}

export default async function CompliancePage() {
  const admin = createAdminClient()

  const [{ data: appliances }, { data: logs }, { data: staff }] = await Promise.all([
    admin
      .from('appliances')
      .select('id, name, kind, target_min, target_max, location')
      .eq('active', true)
      .order('kind')
      .order('name'),
    admin
      .from('temperature_logs')
      .select('id, appliance_id, temperature, in_range, recorded_at, corrective_action, notes, user_id')
      .gte('recorded_at', startOfTodayIso())
      .order('recorded_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ])

  const staffNameById = new Map((staff ?? []).map((p) => [p.id, p.name]))

  // Group today's logs by appliance
  const todayByAppliance = new Map<string, Log[]>()
  for (const l of (logs ?? []) as Log[]) {
    const arr = todayByAppliance.get(l.appliance_id) ?? []
    arr.push(l)
    todayByAppliance.set(l.appliance_id, arr)
  }

  const outOfRangeToday = ((logs ?? []) as Log[]).filter((l) => !l.in_range)

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Compliance — Temperatures
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Today&apos;s temperature logs grouped by appliance.
      </p>

      {outOfRangeToday.length > 0 && (
        <section className="mt-6 rounded-xl border border-brand-amber/60 bg-brand-amber/10 p-5">
          <h2 className="text-sm font-semibold text-brand-forest">
            {outOfRangeToday.length} out-of-range reading
            {outOfRangeToday.length === 1 ? '' : 's'} today
          </h2>
          <ul className="mt-3 divide-y divide-brand-amber/30 text-sm">
            {outOfRangeToday.map((l) => {
              const appliance = (appliances ?? []).find(
                (a) => a.id === l.appliance_id,
              )
              return (
                <li key={l.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-brand-forest">
                      {appliance?.name ?? 'Unknown appliance'} —{' '}
                      <span className="font-mono text-brand-amber">
                        {l.temperature}°C
                      </span>
                    </p>
                    <p className="text-xs text-brand-slate">
                      {new Date(l.recorded_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {staffNameById.get(l.user_id) ?? 'Unknown'}
                    </p>
                  </div>
                  {l.corrective_action && (
                    <p className="mt-1 text-xs text-brand-forest">
                      <strong>Action:</strong> {l.corrective_action}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-6 space-y-3">
        {(appliances ?? []).length === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-sm text-brand-slate">
            No appliances configured. Ask the owner to add them in{' '}
            <Link
              href="/owner/appliances"
              className="text-brand-amber hover:underline"
            >
              Appliances
            </Link>
            .
          </p>
        )}
        {(appliances ?? []).map((a) => {
          const todays = todayByAppliance.get(a.id) ?? []
          const latest = todays[0]
          const allInRange = todays.every((l) => l.in_range)
          return (
            <div
              key={a.id}
              className="rounded-xl border border-brand-sage/40 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-brand-forest">
                    {a.name}
                  </h3>
                  <p className="text-xs uppercase tracking-wide text-brand-slate">
                    {KIND_LABEL[a.kind] ?? a.kind}
                    {a.location ? ` · ${a.location}` : ''} · Target{' '}
                    {formatTarget(a.target_min, a.target_max)}
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
                        {new Date(latest.recorded_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </>
                  ) : (
                    <span className="rounded bg-brand-amber/20 px-2 py-1 text-xs font-medium text-brand-forest">
                      Not logged today
                    </span>
                  )}
                </div>
              </div>

              {todays.length > 0 && (
                <p className="mt-2 text-xs text-brand-slate">
                  {todays.length} log{todays.length === 1 ? '' : 's'} today
                  {allInRange ? ' · all in range' : ''}
                </p>
              )}
            </div>
          )
        })}
      </section>
    </main>
  )
}
