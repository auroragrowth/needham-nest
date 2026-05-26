import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const KIND_LABEL: Record<string, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  hot_hold: 'Hot hold',
  cold_display: 'Cold display',
  ambient: 'Ambient',
}

const FREQ_LABEL: Record<string, string> = {
  open: 'Opening',
  mid: 'Mid-shift',
  close: 'Closing',
  daily: 'Daily',
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

type TempLog = {
  id: string
  appliance_id: string
  temperature: number
  in_range: boolean
  recorded_at: string
  corrective_action: string | null
  notes: string | null
  user_id: string
}

type Task = {
  id: string
  name: string
  frequency: string
  area: string | null
}

type CleanLog = {
  task_id: string
  completed_at: string
  user_id: string
}

export default async function CompliancePage() {
  const admin = createAdminClient()

  const [
    { data: appliances },
    { data: tempLogs },
    { data: tasks },
    { data: cleanLogs },
    { data: staff },
  ] = await Promise.all([
    admin
      .from('appliances')
      .select('id, name, kind, target_min, target_max, location')
      .eq('active', true)
      .order('kind')
      .order('name'),
    admin
      .from('temperature_logs')
      .select(
        'id, appliance_id, temperature, in_range, recorded_at, corrective_action, notes, user_id',
      )
      .gte('recorded_at', startOfTodayIso())
      .order('recorded_at', { ascending: false }),
    admin
      .from('cleaning_tasks')
      .select('id, name, frequency, area')
      .eq('active', true)
      .order('frequency')
      .order('sort_order')
      .order('name'),
    admin
      .from('cleaning_log')
      .select('task_id, completed_at, user_id')
      .gte('completed_at', startOfTodayIso()),
    admin.from('profiles').select('id, name'),
  ])

  const staffNameById = new Map((staff ?? []).map((p) => [p.id, p.name]))
  const todayTempsByAppliance = new Map<string, TempLog[]>()
  for (const l of (tempLogs ?? []) as TempLog[]) {
    const arr = todayTempsByAppliance.get(l.appliance_id) ?? []
    arr.push(l)
    todayTempsByAppliance.set(l.appliance_id, arr)
  }
  const outOfRangeToday = ((tempLogs ?? []) as TempLog[]).filter((l) => !l.in_range)

  const completedByTask = new Map<string, CleanLog>()
  for (const l of (cleanLogs ?? []) as CleanLog[]) {
    if (!completedByTask.has(l.task_id)) completedByTask.set(l.task_id, l)
  }
  const totalTasks = tasks?.length ?? 0
  const doneTasks = completedByTask.size
  const taskPct =
    totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100)

  const incompleteByFreq = new Map<string, Task[]>()
  for (const t of (tasks ?? []) as Task[]) {
    if (completedByTask.has(t.id)) continue
    const arr = incompleteByFreq.get(t.frequency) ?? []
    arr.push(t)
    incompleteByFreq.set(t.frequency, arr)
  }

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Compliance
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Today&apos;s temperature logs and checklist completion.
      </p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Temperatures
      </h2>

      {outOfRangeToday.length > 0 && (
        <section className="mt-3 rounded-xl border border-brand-amber/60 bg-brand-amber/10 p-5">
          <h3 className="text-sm font-semibold text-brand-forest">
            {outOfRangeToday.length} out-of-range reading
            {outOfRangeToday.length === 1 ? '' : 's'} today
          </h3>
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

      <section className="mt-3 space-y-2">
        {(appliances ?? []).length === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-sm text-brand-slate">
            No appliances configured. Add them in{' '}
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
          const todays = todayTempsByAppliance.get(a.id) ?? []
          const latest = todays[0]
          const allInRange = todays.every((l) => l.in_range)
          return (
            <div
              key={a.id}
              className="rounded-xl border border-brand-sage/40 bg-white p-4"
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

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Daily checklist
      </h2>
      <section className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xl font-semibold text-brand-forest">
              {doneTasks} of {totalTasks} done today
            </p>
            <p className="text-xs text-brand-slate">
              {totalTasks === 0
                ? 'No tasks configured.'
                : `${taskPct}% complete`}
            </p>
          </div>
          <div className="w-32">
            <div className="h-2 w-full rounded-full bg-brand-sage/30">
              <div
                className={`h-2 rounded-full ${
                  taskPct === 100 ? 'bg-brand-teal-deep' : 'bg-brand-amber'
                }`}
                style={{ width: `${taskPct}%` }}
              />
            </div>
          </div>
        </div>

        {(['open', 'mid', 'close', 'daily'] as const).map((f) => {
          const items = incompleteByFreq.get(f) ?? []
          if (items.length === 0) return null
          return (
            <div key={f} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-amber">
                {FREQ_LABEL[f]} — not yet done
              </p>
              <ul className="mt-1 text-sm text-brand-forest">
                {items.map((t) => (
                  <li key={t.id} className="py-1">
                    {t.name}
                    {t.area && (
                      <span className="text-xs text-brand-slate"> · {t.area}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}

        {totalTasks > 0 && doneTasks === totalTasks && (
          <p className="mt-3 text-sm text-brand-teal-deep">
            ✓ All tasks ticked off today.
          </p>
        )}
      </section>
    </main>
  )
}
