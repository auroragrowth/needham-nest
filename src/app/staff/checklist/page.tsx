import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeTask } from '@/lib/checklist/actions'

const FREQ_LABEL: Record<string, string> = {
  open: 'Opening',
  mid: 'Mid-shift',
  close: 'Closing',
  daily: 'Daily',
}
const FREQ_ORDER: Array<'open' | 'mid' | 'close' | 'daily'> = [
  'open',
  'mid',
  'close',
  'daily',
]

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

type Task = {
  id: string
  name: string
  frequency: 'open' | 'mid' | 'close' | 'daily'
  area: string | null
  sort_order: number
}

type Log = {
  task_id: string
  completed_at: string
  user_id: string
}

export default async function StaffChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: tasks }, { data: logs }, { data: people }] = await Promise.all([
    admin
      .from('cleaning_tasks')
      .select('id, name, frequency, area, sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name'),
    admin
      .from('cleaning_log')
      .select('task_id, completed_at, user_id')
      .gte('completed_at', startOfTodayIso()),
    admin.from('profiles').select('id, name'),
  ])

  const nameById = new Map((people ?? []).map((p) => [p.id, p.name]))
  const completedByTask = new Map<string, Log>()
  for (const l of (logs ?? []) as Log[]) {
    if (!completedByTask.has(l.task_id)) completedByTask.set(l.task_id, l)
  }

  const grouped = new Map<Task['frequency'], Task[]>()
  for (const f of FREQ_ORDER) grouped.set(f, [])
  for (const t of ((tasks ?? []) as Task[])) {
    grouped.get(t.frequency)?.push(t)
  }

  const totalTasks = tasks?.length ?? 0
  const doneCount = completedByTask.size

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Daily checklist
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {totalTasks === 0
          ? 'No tasks configured yet.'
          : `${doneCount} of ${totalTasks} done today.`}
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

      <div className="mt-6 space-y-6">
        {FREQ_ORDER.map((f) => {
          const items = grouped.get(f) ?? []
          if (items.length === 0) return null
          return (
            <section key={f}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                {FREQ_LABEL[f]}
              </h2>
              <ul className="mt-2 space-y-2">
                {items.map((t) => {
                  const log = completedByTask.get(t.id)
                  const done = Boolean(log)
                  const action = completeTask.bind(null, t.id)
                  return (
                    <li key={t.id}>
                      {done ? (
                        <div className="rounded-2xl border border-brand-teal/40 bg-brand-teal/10 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-brand-forest line-through decoration-brand-teal-deep/40">
                                {t.name}
                              </p>
                              {t.area && (
                                <p className="text-xs text-brand-slate">
                                  {t.area}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-brand-teal-deep">
                                ✓ {nameById.get(log!.user_id) ?? 'Unknown'} ·{' '}
                                {new Date(log!.completed_at).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <form action={action}>
                          <button
                            type="submit"
                            className="block w-full rounded-2xl border border-brand-sage/40 bg-white p-4 text-left transition active:scale-[0.98] hover:border-brand-teal/60 hover:bg-brand-teal/5"
                          >
                            <p className="font-medium text-brand-forest">
                              {t.name}
                            </p>
                            {t.area && (
                              <p className="text-xs text-brand-slate">
                                {t.area}
                              </p>
                            )}
                            <p className="mt-2 text-xs font-medium text-brand-amber">
                              Tap to tick off
                            </p>
                          </button>
                        </form>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        {totalTasks === 0 && (
          <div className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            Ask the owner to add tasks in{' '}
            <span className="text-brand-amber">Daily checklist</span>.
          </div>
        )}
      </div>
    </main>
  )
}
