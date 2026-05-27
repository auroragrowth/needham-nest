import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { requestLeave } from '@/lib/rota/leave-actions'

export default async function NewLeaveRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff/leave"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Your leave
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Request leave
      </h1>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={requestLeave}
        className="mt-6 space-y-3 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
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
        <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label className="block text-xs font-medium text-brand-forest">
            Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Reason"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Submit request
        </button>
      </form>
    </main>
  )
}
