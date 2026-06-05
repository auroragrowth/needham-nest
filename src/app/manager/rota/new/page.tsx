import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShift } from '@/lib/rota/actions'

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; staff?: string; error?: string }>
}) {
  const sp = await searchParams
  const admin = createAdminClient()

  const [{ data: staff }, { data: settingsRows }, { data: availability }] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, name, role')
        .eq('active', true)
        .neq('role', 'owner')
        .order('name'),
      admin
        .from('settings')
        .select('trading_open_time, trading_close_time')
        .limit(1),
      sp.date
        ? admin
            .from('staff_availability')
            .select('staff_user_id, start_time, end_time')
            .eq('date', sp.date)
        : Promise.resolve({ data: [] }),
    ])

  const settings = settingsRows?.[0]
  const openTime = settings?.trading_open_time?.slice(0, 5) ?? '08:00'
  const closeTime = settings?.trading_close_time?.slice(0, 5) ?? '16:00'

  // Index availability for that date so we can sort staff and label entries
  const availByStaff = new Map<
    string,
    Array<{ start: string | null; end: string | null }>
  >()
  for (const a of availability ?? []) {
    const arr = availByStaff.get(a.staff_user_id) ?? []
    arr.push({ start: a.start_time, end: a.end_time })
    availByStaff.set(a.staff_user_id, arr)
  }
  function availLabel(staffId: string): string {
    const list = availByStaff.get(staffId)
    if (!list || list.length === 0) return ''
    return list
      .map((w) =>
        w.start ? `${w.start.slice(0, 5)}–${w.end!.slice(0, 5)}` : 'all day',
      )
      .join(', ')
  }
  // Sort: available staff first, then the rest by name
  const sortedStaff = [...(staff ?? [])].sort((a, b) => {
    const aAvail = availByStaff.has(a.id) ? 1 : 0
    const bAvail = availByStaff.has(b.id) ? 1 : 0
    if (aAvail !== bAvail) return bAvail - aAvail
    return a.name.localeCompare(b.name)
  })

  return (
    <main className="mx-auto max-w-md">
      <Link
        href={`/manager/rota${sp.date ? `?week=${sp.date}` : ''}`}
        className="text-sm text-brand-amber hover:underline"
      >
        ← Rota
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add shift
      </h1>
      <p className="mt-1 text-xs text-brand-slate">
        Defaults to your trading hours ({openTime}–{closeTime}). Edit if it&apos;s
        a partial shift.
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={createShift}
        className="mt-6 space-y-3 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label className="block text-xs font-medium text-brand-forest">
            Person
          </label>
          <select
            name="staff_user_id"
            required
            defaultValue={sp.staff ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="" disabled>
              Pick a person
            </option>
            {sp.date && availByStaff.size > 0 && (
              <optgroup label={`Available on ${sp.date}`}>
                {sortedStaff
                  .filter((s) => availByStaff.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      ✓ {s.name}
                      {s.role === 'manager' ? ' (mgr)' : ''} ·{' '}
                      {availLabel(s.id)}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup
              label={
                sp.date
                  ? 'Not marked available (you can still schedule)'
                  : 'All people'
              }
            >
              {sortedStaff
                .filter((s) => !availByStaff.has(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.role === 'manager' ? ' (mgr)' : ''}
                  </option>
                ))}
            </optgroup>
          </select>
          {sp.date && (
            <p className="mt-1 text-xs text-brand-slate">
              {availByStaff.size === 0
                ? 'No one has marked themselves available for that date yet.'
                : `${availByStaff.size} person${availByStaff.size === 1 ? '' : 's'} available — they show first with their windows.`}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-forest">
            Date
          </label>
          <input
            name="date"
            type="date"
            defaultValue={sp.date}
            required
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Start
            </label>
            <input
              name="start_time"
              type="time"
              required
              defaultValue={openTime}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              End
            </label>
            <input
              name="end_time"
              type="time"
              required
              defaultValue={closeTime}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-forest">
            Notes
          </label>
          <input
            name="notes"
            type="text"
            placeholder="e.g. Pass / front of house"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Add shift
        </button>
      </form>
    </main>
  )
}
