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
  const { data: staff } = await admin
    .from('profiles')
    .select('id, name')
    .eq('active', true)
    .neq('role', 'owner')
    .order('name')

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
            Staff
          </label>
          <select
            name="staff_user_id"
            required
            defaultValue={sp.staff ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="" disabled>
              Pick a staff member
            </option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
