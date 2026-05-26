import { createAdminClient } from '@/lib/supabase/admin'
import {
  addPestControlVisit,
  deletePestControlVisit,
} from '@/lib/compliance/actions'

export default async function PestControlPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('pest_control_visits')
    .select('id, date, company, inspector, findings, actions')
    .order('date', { ascending: false })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Pest control visits
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Visit log for EHO compliance.
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
          Log visit
        </h2>
        <form action={addPestControlVisit} className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Date
            </label>
            <input
              name="date"
              type="date"
              defaultValue={today}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Company
            </label>
            <input
              name="company"
              placeholder="Rentokil / etc."
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Inspector
            </label>
            <input
              name="inspector"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Findings
            </label>
            <textarea
              name="findings"
              rows={2}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Actions taken
            </label>
            <textarea
              name="actions"
              rows={2}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Log visit
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 space-y-3">
        {(rows ?? []).map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-brand-sage/40 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand-forest">
                  {r.company ?? 'Visit'}
                </p>
                <p className="text-xs text-brand-slate">
                  {new Date(r.date).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {r.inspector && ` · ${r.inspector}`}
                </p>
              </div>
              <form action={deletePestControlVisit.bind(null, r.id)}>
                <button
                  type="submit"
                  className="text-xs text-brand-amber hover:underline"
                >
                  Remove
                </button>
              </form>
            </div>
            {r.findings && (
              <p className="mt-2 text-sm text-brand-forest">
                <strong>Findings:</strong> {r.findings}
              </p>
            )}
            {r.actions && (
              <p className="mt-1 text-sm text-brand-slate">
                <strong>Actions:</strong> {r.actions}
              </p>
            )}
          </article>
        ))}
        {(rows?.length ?? 0) === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No visits logged.
          </p>
        )}
      </div>
    </main>
  )
}
