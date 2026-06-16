import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { clockIn, clockOut } from '@/lib/time-logs/actions'

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfWeekIso(): string {
  const d = new Date()
  // Monday start (UK)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = (day + 6) % 7 // Mon=0..Sun=6
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function shiftMs(
  log: { clock_in: string; clock_out: string | null },
  now: Date,
): number {
  const start = new Date(log.clock_in).getTime()
  const end = log.clock_out ? new Date(log.clock_out).getTime() : now.getTime()
  return Math.max(0, end - start)
}

export default async function StaffDashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await requireStaffFeature('clock')

  const admin = createAdminClient()
  const now = new Date()

  const [{ data: openShift }, { data: todays }, { data: weekly }, { data: recent }] =
    await Promise.all([
      admin
        .from('time_logs')
        .select('id, clock_in, clock_out')
        .eq('user_id', session.profileId)
        .is('clock_out', null)
        .maybeSingle(),
      admin
        .from('time_logs')
        .select('clock_in, clock_out')
        .eq('user_id', session.profileId)
        .gte('clock_in', startOfTodayIso())
        .order('clock_in', { ascending: false }),
      admin
        .from('time_logs')
        .select('clock_in, clock_out')
        .eq('user_id', session.profileId)
        .gte('clock_in', startOfWeekIso())
        .order('clock_in', { ascending: false }),
      admin
        .from('time_logs')
        .select('id, clock_in, clock_out')
        .eq('user_id', session.profileId)
        .order('clock_in', { ascending: false })
        .limit(5),
    ])

  const isOnShift = Boolean(openShift)
  const onShiftSince = isOnShift ? new Date(openShift!.clock_in) : null
  const currentShiftMs = isOnShift ? shiftMs(openShift!, now) : 0

  const todayMs = (todays ?? []).reduce((acc, l) => acc + shiftMs(l, now), 0)
  const weekMs = (weekly ?? []).reduce((acc, l) => acc + shiftMs(l, now), 0)

  return (
    <main className="mx-auto max-w-md">
      {params.notice && (
        <p className="mb-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-center text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mb-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-center text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <section className="rounded-xl border border-brand-sage/40 bg-white p-6 text-center">
        {isOnShift ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              On shift
            </p>
            <p className="mt-2 text-4xl font-semibold text-brand-forest">
              {formatDuration(currentShiftMs)}
            </p>
            <p className="mt-1 text-sm text-brand-slate">
              Clocked in at{' '}
              {onShiftSince!.toLocaleTimeString('en-GB', {
                timeZone: 'UTC',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <form action={clockOut} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-amber px-6 py-5 text-xl font-semibold text-brand-forest shadow-sm transition active:scale-[0.98] hover:bg-brand-amber/90"
              >
                Clock out
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-slate">
              Not clocked in
            </p>
            <p className="mt-2 text-4xl font-semibold text-brand-forest">
              {now.toLocaleTimeString('en-GB', {
                timeZone: 'UTC',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <p className="mt-1 text-sm text-brand-slate">
              Tap below to start your shift.
            </p>
            <form action={clockIn} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-2xl bg-brand-forest px-6 py-5 text-xl font-semibold text-brand-cream shadow-sm transition active:scale-[0.98] hover:bg-brand-olive"
              >
                Clock in
              </button>
            </form>
          </>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Today" value={formatDuration(todayMs)} />
        <Stat label="This week" value={formatDuration(weekMs)} />
      </section>

      <section className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-slate">
          Recent shifts
        </h3>
        <ul className="mt-2 divide-y divide-brand-sage/30 text-sm">
          {(recent ?? []).length === 0 && (
            <li className="py-3 text-center text-brand-slate">
              No shifts yet.
            </li>
          )}
          {(recent ?? []).map((l) => {
            const start = new Date(l.clock_in)
            const end = l.clock_out ? new Date(l.clock_out) : null
            const ms = shiftMs(l, now)
            return (
              <li
                key={l.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="text-brand-forest">
                    {start.toLocaleDateString('en-GB', {
                      timeZone: 'UTC',
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-brand-slate">
                    {start.toLocaleTimeString('en-GB', {
                      timeZone: 'UTC',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' → '}
                    {end
                      ? end.toLocaleTimeString('en-GB', {
                          timeZone: 'UTC',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'now'}
                  </p>
                </div>
                <span className="font-mono text-brand-forest">
                  {formatDuration(ms)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-sage/40 bg-white p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-slate">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-brand-forest">{value}</p>
    </div>
  )
}
