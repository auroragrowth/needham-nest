import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteShift, publishWeek } from '@/lib/rota/actions'

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const dow = (x.getDay() + 6) % 7 // Mon=0..Sun=6
  x.setDate(x.getDate() - dow)
  x.setHours(0, 0, 0, 0)
  return x
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmtTime(t: string): string {
  // t is HH:MM:SS, render HH:MM
  return t.slice(0, 5)
}

type Shift = {
  id: string
  staff_user_id: string
  date: string
  start_time: string
  end_time: string
  notes: string | null
  published: boolean
}

export default async function RotaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; notice?: string; error?: string }>
}) {
  const sp = await searchParams
  const admin = createAdminClient()

  const weekStart = sp.week
    ? startOfWeek(new Date(sp.week))
    : startOfWeek(new Date())
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }
  const weekEnd = days[6]
  const fromIso = isoDate(weekStart)
  const toIso = isoDate(weekEnd)

  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const [{ data: staff }, { data: shifts }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, name, role, contracted_weekly_hours')
      .eq('active', true)
      .neq('role', 'owner')
      .order('name'),
    admin
      .from('rota_shifts')
      .select('id, staff_user_id, date, start_time, end_time, notes, published')
      .gte('date', fromIso)
      .lte('date', toIso)
      .order('start_time'),
  ])

  const byStaffDay = new Map<string, Shift[]>()
  for (const s of (shifts ?? []) as Shift[]) {
    const key = `${s.staff_user_id}|${s.date}`
    const arr = byStaffDay.get(key) ?? []
    arr.push(s)
    byStaffDay.set(key, arr)
  }
  const draftCount = (shifts ?? []).filter((s) => !s.published).length

  function shiftHours(s: Shift): number {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    return (eh * 60 + em - (sh * 60 + sm)) / 60
  }

  const hoursByStaff = new Map<string, number>()
  const hoursByDay = new Map<string, number>()
  for (const s of (shifts ?? []) as Shift[]) {
    const h = shiftHours(s)
    hoursByStaff.set(
      s.staff_user_id,
      (hoursByStaff.get(s.staff_user_id) ?? 0) + h,
    )
    hoursByDay.set(s.date, (hoursByDay.get(s.date) ?? 0) + h)
  }
  const weekTotal = Array.from(hoursByDay.values()).reduce((a, h) => a + h, 0)

  return (
    <main className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Rota
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Week of{' '}
            {weekStart.toLocaleDateString([], {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/manager/rota?week=${isoDate(prevWeek)}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            ← Prev
          </Link>
          <Link
            href={`/manager/rota?week=${isoDate(startOfWeek(new Date()))}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            This week
          </Link>
          <Link
            href={`/manager/rota?week=${isoDate(nextWeek)}`}
            className="rounded-lg border border-brand-sage/60 px-3 py-1.5 text-sm text-brand-forest hover:bg-brand-sage/10"
          >
            Next →
          </Link>
          <Link
            href={`/manager/rota/new?date=${fromIso}`}
            className="rounded-lg bg-brand-forest px-4 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            + Add shift
          </Link>
        </div>
      </div>

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

      {draftCount > 0 && (
        <section className="mt-4 flex items-center justify-between rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-4">
          <p className="text-sm text-brand-forest">
            {draftCount} unpublished shift{draftCount === 1 ? '' : 's'} this
            week — staff can&apos;t see them yet.
          </p>
          <form action={publishWeek}>
            <input type="hidden" name="from" value={fromIso} />
            <input type="hidden" name="to" value={toIso} />
            <button
              type="submit"
              className="rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
            >
              Publish week
            </button>
          </form>
        </section>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Person
              </th>
              {days.map((d) => (
                <th
                  key={isoDate(d)}
                  className="border-b border-brand-sage/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate"
                >
                  {d.toLocaleDateString([], {
                    weekday: 'short',
                    day: 'numeric',
                  })}
                </th>
              ))}
              <th className="border-b border-brand-sage/40 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-brand-slate">
                Week
              </th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => {
              const scheduled = hoursByStaff.get(s.id) ?? 0
              const contracted = Number(s.contracted_weekly_hours ?? 0)
              return (
              <tr key={s.id} className="align-top">
                <td className="border-b border-brand-sage/30 px-3 py-2 font-medium text-brand-forest">
                  {s.name}
                  <div className="text-[10px] uppercase tracking-wide text-brand-slate">
                    {s.role}
                    {contracted > 0 && ` · ${contracted}h`}
                  </div>
                </td>
                {days.map((d) => {
                  const key = `${s.id}|${isoDate(d)}`
                  const dayShifts = byStaffDay.get(key) ?? []
                  return (
                    <td
                      key={key}
                      className="border-b border-brand-sage/30 px-2 py-2"
                    >
                      <div className="space-y-1">
                        {dayShifts.map((sh) => (
                          <Link
                            key={sh.id}
                            href={`/manager/rota/${sh.id}`}
                            className={`block rounded-md px-2 py-1 text-xs ${
                              sh.published
                                ? 'border border-brand-teal/40 bg-brand-teal/10 text-brand-teal-deep'
                                : 'border border-brand-amber/40 bg-brand-amber/10 text-brand-forest'
                            }`}
                          >
                            {fmtTime(sh.start_time)}–{fmtTime(sh.end_time)}
                            {!sh.published && (
                              <span className="ml-1 text-[10px] uppercase">
                                draft
                              </span>
                            )}
                            {sh.notes && (
                              <div className="text-[10px] text-brand-slate">
                                {sh.notes}
                              </div>
                            )}
                          </Link>
                        ))}
                        <Link
                          href={`/manager/rota/new?date=${isoDate(d)}&staff=${s.id}`}
                          className="block rounded-md border border-dashed border-brand-sage/40 px-2 py-1 text-center text-[11px] text-brand-slate hover:bg-brand-sage/10"
                        >
                          +
                        </Link>
                      </div>
                    </td>
                  )
                })}
                <td className="border-b border-brand-sage/30 px-3 py-2 text-right font-mono text-xs">
                  <span
                    className={
                      contracted > 0 && scheduled < contracted
                        ? 'text-brand-amber'
                        : 'text-brand-forest'
                    }
                  >
                    {scheduled.toFixed(1)}
                    {contracted > 0 && ` / ${contracted}`}h
                  </span>
                </td>
              </tr>
              )
            })}
            {(staff?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-8 text-center text-sm text-brand-slate"
                >
                  No active staff yet.
                </td>
              </tr>
            )}
          </tbody>
          {(staff?.length ?? 0) > 0 && (
            <tfoot>
              <tr>
                <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand-slate">
                  Day total
                </td>
                {days.map((d) => {
                  const total = hoursByDay.get(isoDate(d)) ?? 0
                  return (
                    <td
                      key={isoDate(d)}
                      className="border-t-2 border-brand-sage/40 px-3 py-2 font-mono text-xs text-brand-forest"
                    >
                      {total.toFixed(1)}h
                    </td>
                  )
                })}
                <td className="border-t-2 border-brand-sage/40 px-3 py-2 text-right font-mono text-xs font-semibold text-brand-forest">
                  {weekTotal.toFixed(1)}h
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </main>
  )
}
