import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  addAvailability,
  deleteAvailability,
} from '@/lib/availability/actions'
import { AvailabilityCalendar } from './Calendar'

function monthRange(monthStr: string): { start: string; end: string } {
  const [yStr, mStr] = monthStr.split('-')
  const y = Number(yStr)
  const m = Number(mStr) - 1
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
    .select('id, date, start_time, end_time')
    .eq('staff_user_id', session.profileId)
    .gte('date', start)
    .lte('date', end)
    .order('date')
    .order('start_time', { nullsFirst: true })

  const byDate: Record<string, Avail[]> = {}
  for (const r of (rows ?? []) as Avail[]) {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  }

  const monthLabel = new Date(
    `${month}-01T00:00:00Z`,
  ).toLocaleDateString([], { month: 'long', year: 'numeric' })

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
            Tap a day to mark when you can work. Vic uses this to plan the
            rota.
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

      <div className="mt-6">
        <AvailabilityCalendar
          month={month}
          byDate={byDate}
          addAction={addAvailability}
          deleteAction={deleteAvailability}
        />
      </div>
    </main>
  )
}
