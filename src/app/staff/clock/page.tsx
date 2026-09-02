import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import {
  clockIn,
  clockOut,
  startBreak,
} from '@/lib/time-logs/actions'
import { BackToWorkButton } from './BackToWorkButton'

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
  searchParams: Promise<{ notice?: string; error?: string; action?: string }>
}) {
  const params = await searchParams
  // A scanned clock QR lands here as e.g. ?action=clock-in. Preserve that
  // intent through the login redirect if the session has expired.
  const returnTo = params.action
    ? `/staff/clock?action=${encodeURIComponent(params.action)}`
    : undefined
  const session = await requireStaffFeature('clock', returnTo)

  const admin = createAdminClient()
  const now = new Date()

  const [{ data: openShift }, { data: todays }, { data: weekly }, { data: recent }] =
    await Promise.all([
      admin
        .from('time_logs')
        .select(
          'id, clock_in, clock_out, break_start_at, break_minutes_total',
        )
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

  // Pull DOB so we can pick the right statutory break minimum
  // (under-18s need 30 min, adults 20 min).
  const { data: meProfile } = await admin
    .from('profiles')
    .select('date_of_birth')
    .eq('id', session.profileId)
    .maybeSingle()
  const isUnder18 = (() => {
    if (!meProfile?.date_of_birth) return false
    const dob = new Date(meProfile.date_of_birth + 'T00:00:00Z')
    const eighteenth = new Date(
      Date.UTC(
        dob.getUTCFullYear() + 18,
        dob.getUTCMonth(),
        dob.getUTCDate(),
      ),
    )
    return now < eighteenth
  })()
  const requiredBreakMinutes = isUnder18 ? 30 : 20

  // Deep-linked action from a scanned QR (?action=clock-in|clock-out|
  // break-start|break-end). We only ever show a one-tap CONFIRM here — the
  // GET itself never mutates, so a stray scan can't clock anyone in/out.
  const onBreak = Boolean(openShift?.break_start_at)
  type ActionKind = 'clockIn' | 'clockOut' | 'startBreak' | 'endBreak'
  const actionSpecs: Record<
    string,
    { verb: string; valid: boolean; kind: ActionKind }
  > = {
    'clock-in': { verb: 'clock in', valid: !isOnShift, kind: 'clockIn' },
    'clock-out': {
      verb: 'clock out',
      valid: isOnShift && !onBreak,
      kind: 'clockOut',
    },
    'break-start': {
      verb: 'go on break',
      valid: isOnShift && !onBreak,
      kind: 'startBreak',
    },
    'break-end': {
      verb: 'return from break',
      valid: isOnShift && onBreak,
      kind: 'endBreak',
    },
  }
  const requested = params.action ? actionSpecs[params.action] : undefined
  let invalidMsg = ''
  if (requested && !requested.valid) {
    if (!isOnShift) invalidMsg = "You're not clocked in yet."
    else if (onBreak && requested.kind !== 'endBreak')
      invalidMsg = "You're on a break — tap Return from break first."
    else if (!onBreak && requested.kind === 'endBreak')
      invalidMsg = "You're not on a break right now."
    else if (isOnShift && requested.kind === 'clockIn')
      invalidMsg = "You're already clocked in."
    else invalidMsg = "That action isn't available right now."
  }

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

      {params.action && (
        <section className="mb-4 rounded-xl border-2 border-brand-forest bg-white p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-slate">
            {session.name}
          </p>
          {requested && requested.valid ? (
            <>
              <p className="mt-1 text-lg font-semibold text-brand-forest">
                Tap to {requested.verb}
              </p>
              <div className="mt-4">
                {requested.kind === 'clockIn' && (
                  <form action={clockIn}>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-brand-forest px-6 py-5 text-xl font-semibold text-brand-cream shadow-sm transition active:scale-[0.98] hover:bg-brand-olive"
                    >
                      Clock in
                    </button>
                  </form>
                )}
                {requested.kind === 'clockOut' && (
                  <form action={clockOut}>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-brand-amber px-6 py-5 text-xl font-semibold text-brand-forest shadow-sm transition active:scale-[0.98] hover:bg-brand-amber/90"
                    >
                      Clock out
                    </button>
                  </form>
                )}
                {requested.kind === 'startBreak' && (
                  <form action={startBreak}>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-brand-sage px-6 py-5 text-xl font-semibold text-brand-forest shadow-sm transition active:scale-[0.98] hover:bg-brand-sage/80"
                    >
                      Go on break
                    </button>
                  </form>
                )}
                {requested.kind === 'endBreak' && (
                  <BackToWorkButton
                    breakStartAt={openShift!.break_start_at!}
                    requiredMinutes={requiredBreakMinutes}
                  />
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-brand-slate">
              {requested
                ? invalidMsg
                : 'That link is not recognised.'}{' '}
              Use the buttons below.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-brand-sage/40 bg-white p-6 text-center">
        {isOnShift ? (
          openShift?.break_start_at ? (
            // ON BREAK — only show 'Back to work' (no clock-out while on break).
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-amber">
                On break
              </p>
              <p className="mt-2 text-4xl font-semibold text-brand-forest">
                {formatDuration(
                  Date.now() -
                    new Date(openShift.break_start_at).getTime(),
                )}
              </p>
              <p className="mt-1 text-sm text-brand-slate">
                Break started{' '}
                {new Date(openShift.break_start_at).toLocaleTimeString(
                  'en-GB',
                  {
                    timeZone: 'Europe/London',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}{' '}
                · this time isn&apos;t paid
              </p>
              <div className="mt-6">
                <BackToWorkButton
                  breakStartAt={openShift!.break_start_at!}
                  requiredMinutes={requiredBreakMinutes}
                />
              </div>
            </>
          ) : (
            // ON SHIFT — show 'On break' + 'Clock out'.
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
                  timeZone: 'Europe/London',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {openShift?.break_minutes_total
                  ? ` · ${openShift.break_minutes_total}m break taken`
                  : ''}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <form action={startBreak}>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-brand-sage px-4 py-5 text-lg font-semibold text-brand-forest shadow-sm transition active:scale-[0.98] hover:bg-brand-sage/80"
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      minHeight: '44px',
                    }}
                  >
                    On break
                  </button>
                </form>
                <form action={clockOut}>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-brand-amber px-4 py-5 text-lg font-semibold text-brand-forest shadow-sm transition active:scale-[0.98] hover:bg-brand-amber/90"
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      minHeight: '44px',
                    }}
                  >
                    Clock out
                  </button>
                </form>
              </div>
            </>
          )
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-slate">
              Not clocked in
            </p>
            <p className="mt-2 text-4xl font-semibold text-brand-forest">
              {now.toLocaleTimeString('en-GB', {
                timeZone: 'Europe/London',
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
                      timeZone: 'Europe/London',
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-brand-slate">
                    {start.toLocaleTimeString('en-GB', {
                      timeZone: 'Europe/London',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' → '}
                    {end
                      ? end.toLocaleTimeString('en-GB', {
                          timeZone: 'Europe/London',
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
