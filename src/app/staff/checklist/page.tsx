import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { completeTask } from '@/lib/checklist/actions'
import { clockIn, clockOut } from '@/lib/time-logs/actions'
import { getClosingStatus, isBlocked } from '@/lib/checklist/closing'

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
  const session = await requireStaffFeature('checklist')
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

  // Clocking in is the first item of the opening list and signing out the
  // last item of the closing list — both derived from the real time log, so
  // neither can be ticked without actually happening.
  const [{ data: openShift }, closing] = await Promise.all([
    admin
      .from('time_logs')
      .select('id, clock_in')
      .eq('user_id', session.profileId)
      .is('clock_out', null)
      .maybeSingle(),
    getClosingStatus(session.profileId),
  ])
  const onShift = Boolean(openShift)
  const signOutBlocked = isBlocked(closing)

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

  const totalTasks = (tasks?.length ?? 0) + 2
  const doneCount = completedByTask.size + (onShift ? 1 : 0)

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Daily checklist
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {`${doneCount} of ${totalTasks} done today.`}
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
          // Opening and closing always render — they carry the clock-in and
          // sign-out items even when no cleaning tasks are configured.
          if (items.length === 0 && f !== 'open' && f !== 'close') return null
          return (
            <section key={f}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                {FREQ_LABEL[f]}
              </h2>
              <ul className="mt-2 space-y-2">
                {f === 'open' && (
                  <li>
                    <ClockInItem
                      onShift={onShift}
                      clockInAt={openShift?.clock_in ?? null}
                    />
                  </li>
                )}
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
                {f === 'close' && (
                  <li>
                    <SignOutItem
                      onShift={onShift}
                      blocked={signOutBlocked}
                      outstanding={closing.outstanding.length}
                    />
                  </li>
                )}
              </ul>
            </section>
          )
        })}

        {(tasks?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            Ask the owner to add tasks in{' '}
            <span className="text-brand-amber">Daily checklist</span>.
          </div>
        )}
      </div>
    </main>
  )
}

/** First item of the opening list — ticks itself once you're clocked in. */
function ClockInItem({
  onShift,
  clockInAt,
}: {
  onShift: boolean
  clockInAt: string | null
}) {
  if (onShift) {
    return (
      <div className="rounded-2xl border border-brand-teal/40 bg-brand-teal/10 p-4">
        <p className="font-medium text-brand-forest line-through decoration-brand-teal-deep/40">
          Clock in
        </p>
        <p className="mt-1 text-xs text-brand-teal-deep">
          ✓ You clocked in at{' '}
          {clockInAt
            ? new Date(clockInAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </p>
      </div>
    )
  }

  return (
    <form action={clockIn}>
      <button
        type="submit"
        className="block w-full rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-4 text-left transition active:scale-[0.98] hover:bg-brand-amber/20"
      >
        <p className="font-medium text-brand-forest">Clock in</p>
        <p className="text-xs text-brand-slate">Do this first, before anything else</p>
        <p className="mt-2 text-xs font-medium text-brand-amber">
          Tap to start your shift
        </p>
      </button>
    </form>
  )
}

/**
 * Last item of the closing list — the real clock-out. Blocked while closing
 * jobs are outstanding, unless they give a reason (which lands on the
 * timesheet for the manager to see).
 */
function SignOutItem({
  onShift,
  blocked,
  outstanding,
}: {
  onShift: boolean
  blocked: boolean
  outstanding: number
}) {
  if (!onShift) {
    return (
      <div className="rounded-2xl border border-brand-sage/40 bg-brand-sage/5 p-4">
        <p className="font-medium text-brand-slate">Sign out</p>
        <p className="mt-1 text-xs text-brand-slate">
          You are not clocked in.
        </p>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-4">
        <p className="font-medium text-brand-forest">Sign out</p>
        <p className="mt-1 text-sm text-brand-forest">
          🔒 {outstanding} closing{' '}
          {outstanding === 1 ? 'job is' : 'jobs are'} still to tick off. You are
          the last one on shift, so please finish the list before you go.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-brand-amber">
            Something can&apos;t be done tonight?
          </summary>
          <form action={clockOut} className="mt-2">
            <label
              htmlFor="override_reason"
              className="block text-xs text-brand-slate"
            >
              Tell us why — this goes on your timesheet for May and Paul.
            </label>
            <textarea
              id="override_reason"
              name="override_reason"
              rows={3}
              required
              minLength={4}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
            />
            <button
              type="submit"
              className="mt-2 rounded-lg border border-brand-sage/60 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
            >
              Sign out anyway
            </button>
          </form>
        </details>
      </div>
    )
  }

  return (
    <form action={clockOut}>
      <button
        type="submit"
        className="block w-full rounded-2xl border-2 border-brand-forest bg-brand-forest p-4 text-left text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive"
      >
        <p className="font-medium">Sign out</p>
        <p className="text-xs text-brand-cream/80">
          The last thing you do before you leave
        </p>
        <p className="mt-2 text-xs font-medium text-brand-amber">
          Tap to end your shift
        </p>
      </button>
    </form>
  )
}
