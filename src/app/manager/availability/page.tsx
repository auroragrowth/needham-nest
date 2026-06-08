import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { colourForProfile } from '@/lib/colours'

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtTime(t: string | null): string {
  if (!t) return 'all day'
  return t.slice(0, 5)
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  })
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default async function AvailabilityOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const month =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [y, m] = month.split('-').map(Number)
  const firstDay = new Date(Date.UTC(y, m - 1, 1))
  const lastDay = new Date(Date.UTC(y, m, 0))
  const fromIso = isoDate(firstDay)
  const toIso = isoDate(lastDay)

  const admin = createAdminClient()
  const [{ data: staff }, { data: avail }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, name, role')
      .eq('active', true)
      .neq('role', 'owner')
      .order('name'),
    admin
      .from('staff_availability')
      .select('staff_user_id, date, start_time, end_time')
      .gte('date', fromIso)
      .lte('date', toIso),
  ])

  type Window = { start: string | null; end: string | null }
  const byDay = new Map<string, Map<string, Window[]>>()
  for (const a of avail ?? []) {
    let day = byDay.get(a.date)
    if (!day) {
      day = new Map()
      byDay.set(a.date, day)
    }
    const arr = day.get(a.staff_user_id) ?? []
    arr.push({ start: a.start_time, end: a.end_time })
    day.set(a.staff_user_id, arr)
  }

  const staffById = new Map((staff ?? []).map((s) => [s.id, s]))

  const firstDow = firstDay.getUTCDay()
  const monMon = (firstDow + 6) % 7
  const daysInMonth = lastDay.getUTCDate()

  // Per-staff total days available this month
  const totalsByStaff = new Map<string, number>()
  for (const day of byDay.values()) {
    for (const staffId of day.keys()) {
      totalsByStaff.set(staffId, (totalsByStaff.get(staffId) ?? 0) + 1)
    }
  }

  return (
    <main className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Staff availability
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Who&apos;s marked themselves free in {monthLabel(month)}. Tap a
            shift on the rota to schedule.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/manager/availability?month=${shiftMonth(month, -1)}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            ← {monthLabel(shiftMonth(month, -1))}
          </Link>
          <Link
            href={`/manager/availability?month=${shiftMonth(month, 1)}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            {monthLabel(shiftMonth(month, 1))} →
          </Link>
        </div>
      </div>

      {/* Staff legend with totals */}
      <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-brand-sage/40 bg-white p-3">
        {(staff ?? []).map((s) => {
          const col = colourForProfile(s.id)
          const total = totalsByStaff.get(s.id) ?? 0
          return (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{
                borderColor: col.border,
                backgroundColor: col.bg,
                color: col.text,
              }}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: col.dot }}
              />
              {s.name}
              <span className="font-mono opacity-70">{total}d</span>
            </span>
          )
        })}
        {(staff?.length ?? 0) === 0 && (
          <span className="text-xs text-brand-slate">No active staff yet.</span>
        )}
      </div>

      {/* Month grid */}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-brand-slate"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: monMon }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1
          const dateStr = `${month}-${String(dayNum).padStart(2, '0')}`
          const dayMap = byDay.get(dateStr)
          const entries = dayMap
            ? Array.from(dayMap.entries()).sort(([a], [b]) => {
                const an = staffById.get(a)?.name ?? ''
                const bn = staffById.get(b)?.name ?? ''
                return an.localeCompare(bn)
              })
            : []
          const isToday = dateStr === isoDate(now)
          return (
            <Link
              key={dateStr}
              href={`/manager/rota/new?date=${dateStr}`}
              className={`min-h-[96px] rounded-md border p-1.5 text-left text-xs transition hover:border-brand-amber/60 ${
                isToday
                  ? 'border-brand-amber bg-brand-amber/10'
                  : entries.length > 0
                    ? 'border-brand-teal/40 bg-brand-teal/5'
                    : 'border-brand-sage/40 bg-white'
              }`}
            >
              <p className="text-[11px] font-semibold text-brand-forest">
                {dayNum}
              </p>
              <ul className="mt-1 space-y-0.5">
                {entries.map(([staffId, windows]) => {
                  const s = staffById.get(staffId)
                  if (!s) return null
                  const col = colourForProfile(staffId)
                  return (
                    <li
                      key={staffId}
                      className="flex items-baseline gap-1 truncate rounded px-1 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: col.bg,
                        color: col.text,
                      }}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: col.dot }}
                      />
                      <span className="truncate font-medium">
                        {s.name.split(' ')[0]}
                      </span>
                      <span className="ml-auto truncate text-[9px] opacity-80">
                        {windows
                          .map((w) =>
                            w.start
                              ? `${fmtTime(w.start)}–${fmtTime(w.end)}`
                              : 'all day',
                          )
                          .join(', ')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Link>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-brand-slate">
        Tap any day to add a shift on that date.
      </p>
    </main>
  )
}
