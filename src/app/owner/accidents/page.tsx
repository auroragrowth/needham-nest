import { createAdminClient } from '@/lib/supabase/admin'
import { addAccident, deleteAccident } from '@/lib/compliance/actions'

export default async function AccidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('accident_log')
    .select('id, occurred_at, person, description, action_taken, riddor_reportable, reported_at')
    .order('occurred_at', { ascending: false })

  const now = new Date()
  const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Accident log
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Digital accident book. RIDDOR-reportable incidents are flagged for HSE
        notification.
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
          Log accident
        </h2>
        <form action={addAccident} className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              When
            </label>
            <input
              name="occurred_at"
              type="datetime-local"
              defaultValue={nowLocal}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Person involved
            </label>
            <input
              name="person"
              required
              placeholder="Staff member / customer"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Description
            </label>
            <textarea
              name="description"
              required
              rows={2}
              placeholder="What happened?"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Action taken
            </label>
            <textarea
              name="action_taken"
              rows={2}
              placeholder="First aid given, etc."
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="riddor_reportable"
              className="h-4 w-4 rounded border-brand-sage/60 accent-brand-amber"
            />
            <span className="text-brand-forest">
              RIDDOR-reportable (≥ 7-day injury, hospital, dangerous occurrence)
            </span>
          </label>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Log accident
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 space-y-3">
        {(rows ?? []).map((r) => (
          <article
            key={r.id}
            className={`rounded-xl border bg-white p-5 ${
              r.riddor_reportable
                ? 'border-brand-amber/50'
                : 'border-brand-sage/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand-forest">
                  {r.person}{' '}
                  {r.riddor_reportable && (
                    <span className="ml-2 rounded bg-brand-amber/30 px-2 py-0.5 text-xs font-semibold text-brand-forest">
                      RIDDOR
                    </span>
                  )}
                </p>
                <p className="text-xs text-brand-slate">
                  {new Date(r.occurred_at).toLocaleString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <form action={deleteAccident.bind(null, r.id)}>
                <button
                  type="submit"
                  className="text-xs text-brand-amber hover:underline"
                >
                  Remove
                </button>
              </form>
            </div>
            <p className="mt-2 text-sm text-brand-forest whitespace-pre-wrap">
              {r.description}
            </p>
            {r.action_taken && (
              <p className="mt-2 text-sm text-brand-slate">
                <strong>Action:</strong> {r.action_taken}
              </p>
            )}
          </article>
        ))}
        {(rows?.length ?? 0) === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No accidents logged.
          </p>
        )}
      </div>
    </main>
  )
}
