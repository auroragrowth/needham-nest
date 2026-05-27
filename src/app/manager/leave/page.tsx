import { createAdminClient } from '@/lib/supabase/admin'
import { decideLeave, deleteLeave, requestLeave } from '@/lib/rota/leave-actions'

const KIND_LABEL: Record<string, string> = {
  holiday: 'Holiday',
  sick: 'Sick',
  unpaid: 'Unpaid',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-brand-amber/30 text-brand-forest',
  approved: 'bg-brand-teal-deep text-brand-cream',
  declined: 'bg-brand-sage/40 text-brand-forest',
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1
}

export default async function ManagerLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: rows }, { data: staff }] = await Promise.all([
    admin
      .from('leave_requests')
      .select('id, staff_user_id, kind, start_date, end_date, status, notes, requested_at, decided_notes')
      .order('start_date', { ascending: false }),
    admin
      .from('profiles')
      .select('id, name, annual_leave_days')
      .eq('active', true)
      .neq('role', 'owner')
      .order('name'),
  ])

  const staffById = new Map((staff ?? []).map((p) => [p.id, p]))

  const pending = (rows ?? []).filter((r) => r.status === 'pending')
  const decided = (rows ?? []).filter((r) => r.status !== 'pending')

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Leave
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Holiday, sick and unpaid leave requests.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Log leave for a staff member
        </h2>
        <form action={requestLeave} className="mt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Staff
            </label>
            <select
              name="staff_user_id"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            >
              <option value="" disabled>
                Pick staff
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
              Kind
            </label>
            <select
              name="kind"
              required
              defaultValue="holiday"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            >
              <option value="holiday">Holiday</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-brand-forest">
                Start
              </label>
              <input
                name="start_date"
                type="date"
                required
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-forest">
                End
              </label>
              <input
                name="end_date"
                type="date"
                required
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Notes
            </label>
            <input
              name="notes"
              type="text"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Submit
            </button>
          </div>
        </form>
      </section>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Pending ({pending.length})
      </h2>
      <div className="mt-2 space-y-3">
        {pending.map((r) => {
          const p = staffById.get(r.staff_user_id)
          const days = daysBetween(r.start_date, r.end_date)
          return (
            <article
              key={r.id}
              className="rounded-xl border border-brand-amber/50 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-forest">
                    {p?.name ?? '—'}{' '}
                    <span className="ml-2 rounded bg-brand-amber/20 px-2 py-0.5 text-xs">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                  </p>
                  <p className="text-xs text-brand-slate">
                    {r.start_date} → {r.end_date} ({days} day{days === 1 ? '' : 's'})
                  </p>
                  {r.notes && (
                    <p className="mt-2 text-sm text-brand-forest">{r.notes}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <form
                  action={decideLeave.bind(null, r.id, 'approved')}
                  className="flex items-end gap-2"
                >
                  <input
                    name="decided_notes"
                    type="text"
                    placeholder="Note (optional)"
                    className="rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-teal-deep px-3 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-teal"
                  >
                    Approve
                  </button>
                </form>
                <form action={decideLeave.bind(null, r.id, 'declined')}>
                  <button
                    type="submit"
                    className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-3 py-1.5 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
                  >
                    Decline
                  </button>
                </form>
                <form action={deleteLeave.bind(null, r.id)}>
                  <button
                    type="submit"
                    className="text-xs text-brand-amber hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </article>
          )
        })}
        {pending.length === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No pending requests.
          </p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Decided
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3 text-right">Days</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {decided.map((r) => {
              const p = staffById.get(r.staff_user_id)
              return (
                <tr key={r.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 text-brand-forest">
                    {p?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-slate">
                    {r.start_date} → {r.end_date}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {daysBetween(r.start_date, r.end_date)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`rounded px-2 py-0.5 ${STATUS_STYLE[r.status] ?? ''}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              )
            })}
            {decided.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No decided requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
