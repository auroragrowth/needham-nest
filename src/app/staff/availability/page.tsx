import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  addAvailability,
  deleteAvailability,
} from '@/lib/availability/actions'

function fmtTime(t: string | null): string | null {
  if (!t) return null
  return t.slice(0, 5)
}

function monthRange(monthStr: string): { start: string; end: string } {
  // monthStr = "YYYY-MM" — return first and last day of that month
  const [yStr, mStr] = monthStr.split('-')
  const y = Number(yStr)
  const m = Number(mStr) - 1 // 0-indexed
  const first = new Date(Date.UTC(y, m, 1))
  const last = new Date(Date.UTC(y, m + 1, 0))
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
  }
}

function nextMonth(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-')
  let y = Number(yStr)
  let m = Number(mStr)
  m += 1
  if (m > 12) {
    m = 1
    y += 1
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

function prevMonth(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-')
  let y = Number(yStr)
  let m = Number(mStr)
  m -= 1
  if (m < 1) {
    m = 12
    y -= 1
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

type Avail = {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  notes: string | null
}

export default async function StaffAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; notice?: string; error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const defaultMonth = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, '0')}`
  const month = sp.month ?? defaultMonth
  const { start, end } = monthRange(month)

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('staff_availability')
    .select('id, date, start_time, end_time, notes')
    .eq('staff_user_id', session.profileId)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('start_time', { nullsFirst: true })

  // Build a day grid for the month
  const [yStr, mStr] = month.split('-')
  const y = Number(yStr)
  const m = Number(mStr) - 1
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay() // 0=Sun
  const monMon = (firstDow + 6) % 7 // 0=Mon..6=Sun for grid leading blanks
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

  const byDate = new Map<string, Avail[]>()
  for (const r of (rows ?? []) as Avail[]) {
    const arr = byDate.get(r.date) ?? []
    arr.push(r)
    byDate.set(r.date, arr)
  }

  const monthLabel = new Date(Date.UTC(y, m, 1)).toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  })

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Your availability
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Add the days and times you can work. Vic uses this to plan the
            rota — only people who&apos;ve marked themselves available can be
            scheduled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/staff/availability?month=${prevMonth(month)}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            ← Prev
          </Link>
          <Link
            href={`/staff/availability?month=${nextMonth(month)}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            Next →
          </Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-brand-teal-deep">{monthLabel}</p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Add availability
        </h2>
        <form action={addAvailability} className="mt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Date
            </label>
            <input
              name="date"
              type="date"
              required
              defaultValue={start}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="all_day"
              type="checkbox"
              name="all_day"
              defaultChecked
              className="h-4 w-4 rounded border-brand-sage/60 accent-brand-teal-deep"
            />
            <label htmlFor="all_day" className="text-sm text-brand-forest">
              Available all day (within trading hours)
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              From
            </label>
            <input
              name="start_time"
              type="time"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              To
            </label>
            <input
              name="end_time"
              type="time"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Notes (optional)
            </label>
            <input
              name="notes"
              type="text"
              placeholder="e.g. can stay later if needed"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Save availability
            </button>
            <p className="mt-2 text-xs text-brand-slate">
              Tick &quot;all day&quot; OR fill in From/To. You can add multiple
              windows for one day (e.g. 9-12 and 3-5).
            </p>
          </div>
        </form>
      </section>

      <div className="mt-6 grid grid-cols-7 gap-1">
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
        {Array.from({ length: lastDay }, (_, i) => {
          const dayNum = i + 1
          const dateStr = `${month}-${String(dayNum).padStart(2, '0')}`
          const entries = byDate.get(dateStr) ?? []
          return (
            <div
              key={dateStr}
              className={`min-h-[64px] rounded-md border p-1.5 text-xs ${
                entries.length > 0
                  ? 'border-brand-teal/40 bg-brand-teal/10'
                  : 'border-brand-sage/30 bg-white'
              }`}
            >
              <p className="text-[11px] font-semibold text-brand-forest">
                {dayNum}
              </p>
              <ul className="mt-1 space-y-0.5">
                {entries.map((e) => {
                  const label = e.start_time
                    ? `${fmtTime(e.start_time)}–${fmtTime(e.end_time)}`
                    : 'all day'
                  return (
                    <li
                      key={e.id}
                      className="flex items-center justify-between rounded bg-brand-teal-deep/15 px-1 py-0.5 text-[10px]"
                    >
                      <span className="truncate text-brand-teal-deep">
                        {label}
                      </span>
                      <form
                        action={deleteAvailability.bind(null, e.id)}
                        className="ml-1"
                      >
                        <button
                          type="submit"
                          className="text-brand-amber hover:underline"
                          title="Remove"
                          aria-label="Remove availability"
                        >
                          ×
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </main>
  )
}
