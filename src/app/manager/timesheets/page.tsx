import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

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
  const day = d.getDay()
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

type Row = {
  id: string
  user_id: string
  clock_in: string
  clock_out: string | null
  hourly_rate: number | null
}

export default async function TimesheetsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager' && session.role !== 'owner') {
    redirect('/')
  }

  const admin = createAdminClient()
  const now = new Date()

  const [{ data: staff }, { data: weekLogs }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, name, active')
      .eq('role', 'staff')
      .order('active', { ascending: false })
      .order('name'),
    admin
      .from('time_logs')
      .select('id, user_id, clock_in, clock_out, hourly_rate')
      .gte('clock_in', startOfWeekIso())
      .order('clock_in', { ascending: false }),
  ])

  const todayStart = startOfTodayIso()
  const todayLogs = (weekLogs ?? []).filter(
    (l: Row) => l.clock_in >= todayStart,
  )

  // Group by user
  const byUserToday = new Map<string, Row[]>()
  const byUserWeek = new Map<string, Row[]>()
  for (const l of weekLogs ?? []) {
    const arr = byUserWeek.get(l.user_id) ?? []
    arr.push(l)
    byUserWeek.set(l.user_id, arr)
  }
  for (const l of todayLogs) {
    const arr = byUserToday.get(l.user_id) ?? []
    arr.push(l)
    byUserToday.set(l.user_id, arr)
  }

  const currentlyOn = (weekLogs ?? []).filter(
    (l: Row) => l.clock_out === null,
  )

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Timesheets
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Week of{' '}
        {new Date(startOfWeekIso()).toLocaleDateString([], {
          day: 'numeric',
          month: 'short',
        })}{' '}
        — today is{' '}
        {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
      </p>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          On shift right now
        </h2>
        {currentlyOn.length === 0 ? (
          <p className="mt-3 text-sm text-brand-slate">
            No one is currently clocked in.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-brand-sage/30">
            {currentlyOn.map((l) => {
              const member = (staff ?? []).find((s) => s.id === l.user_id)
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="font-medium text-brand-forest">
                      {member?.name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-brand-slate">
                      Since{' '}
                      {new Date(l.clock_in).toLocaleTimeString('en-GB', {
                        timeZone: 'UTC',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className="font-mono text-brand-teal-deep">
                    {formatDuration(shiftMs(l, now))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Hours by staff member
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3 text-right">Today</th>
              <th className="px-5 py-3 text-right">This week</th>
              <th className="px-5 py-3 text-right">Shifts (wk)</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? [])
              .filter((s) => s.active)
              .map((s) => {
                const tLogs = byUserToday.get(s.id) ?? []
                const wLogs = byUserWeek.get(s.id) ?? []
                const tMs = tLogs.reduce((a, l) => a + shiftMs(l, now), 0)
                const wMs = wLogs.reduce((a, l) => a + shiftMs(l, now), 0)
                return (
                  <tr key={s.id} className="border-t border-brand-sage/30">
                    <td className="px-5 py-3 font-medium text-brand-forest">
                      {s.name}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-brand-forest">
                      {tMs ? formatDuration(tMs) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-brand-forest">
                      {wMs ? formatDuration(wMs) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-brand-slate">
                      {wLogs.length}
                    </td>
                  </tr>
                )
              })}
            {(staff ?? []).filter((s) => s.active).length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-sm text-brand-slate"
                >
                  No active staff. Add them via Owner → People.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}
