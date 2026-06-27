import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteShift, updateShift } from '@/lib/rota/actions'

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()
  const [{ data: shift }, { data: staff }] = await Promise.all([
    admin
      .from('rota_shifts')
      .select('id, staff_user_id, date, start_time, end_time, notes, published, break_minutes')
      .eq('id', id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('id, name')
      .eq('active', true)
      .eq('on_rota', true)
      .order('name'),
  ])
  if (!shift) notFound()

  const update = updateShift.bind(null, id)
  const del = deleteShift.bind(null, id, shift.date)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href={`/manager/rota?week=${shift.date}`}
        className="text-sm text-brand-amber hover:underline"
      >
        ← Rota
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Edit shift
      </h1>
      <p className="mt-1 text-xs text-brand-slate">
        {shift.published ? 'Published' : 'Draft'}
      </p>

      <form
        action={update}
        className="mt-6 space-y-3 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label className="block text-xs font-medium text-brand-forest">
            Staff
          </label>
          <select
            name="staff_user_id"
            required
            defaultValue={shift.staff_user_id}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="edit_shift_date"
            className="block text-xs font-medium text-brand-forest"
          >
            Date
          </label>
          <input
            id="edit_shift_date"
            name="date"
            type="date"
            required
            defaultValue={shift.date}
            min="2024-01-01"
            max="2099-12-31"
            className="mt-1 block w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              minHeight: '44px',
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="edit_shift_start"
              className="block text-xs font-medium text-brand-forest"
            >
              Start
            </label>
            <input
              id="edit_shift_start"
              name="start_time"
              type="time"
              required
              defaultValue={shift.start_time.slice(0, 5)}
              className="mt-1 block w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                minHeight: '44px',
              }}
            />
          </div>
          <div>
            <label
              htmlFor="edit_shift_end"
              className="block text-xs font-medium text-brand-forest"
            >
              End
            </label>
            <input
              id="edit_shift_end"
              name="end_time"
              type="time"
              required
              defaultValue={shift.end_time.slice(0, 5)}
              className="mt-1 block w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                WebkitAppearance: 'none',
                minHeight: '44px',
              }}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="break_minutes_edit"
            className="block text-xs font-medium text-brand-forest"
          >
            Break (minutes)
          </label>
          <input
            id="break_minutes_edit"
            name="break_minutes"
            type="number"
            min="0"
            max="240"
            step="5"
            defaultValue={shift.break_minutes ?? 0}
            className="mt-1 block w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              WebkitAppearance: 'none',
              minHeight: '44px',
            }}
          />
          <p className="mt-1 text-xs text-brand-slate">
            Statutory minimum: 20 min if shift &gt; 6h (30 min / 4.5h for
            under-18s). Counts as unpaid time.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-brand-forest">
            Notes
          </label>
          <input
            name="notes"
            type="text"
            defaultValue={shift.notes ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Save changes
        </button>
      </form>

      <section className="mt-4 rounded-xl border border-brand-amber/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-amber">
          Delete
        </h2>
        <form action={del} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
          >
            Delete shift
          </button>
        </form>
      </section>
    </main>
  )
}
