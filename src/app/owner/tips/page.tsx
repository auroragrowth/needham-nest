import { createAdminClient } from '@/lib/supabase/admin'
import { deleteTipPool, recordTipPool } from '@/lib/wages/actions'

type Dist = { user_id: string; hours: number; amount: number }

export default async function TipsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: pools }, { data: staff }] = await Promise.all([
    admin
      .from('tip_pools')
      .select('id, date, total_collected, distribution, notes')
      .order('date', { ascending: false })
      .limit(60),
    admin.from('profiles').select('id, name'),
  ])

  const staffNameById = new Map((staff ?? []).map((p) => [p.id, p.name]))
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Tips (tronc)
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Pool tips for a day and split pro-rata by hours worked that date.
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
          Record a tip pool
        </h2>
        <form action={recordTipPool} className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Date
            </label>
            <input
              name="date"
              type="date"
              defaultValue={yesterday}
              required
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Total collected (£)
            </label>
            <input
              name="total_collected"
              type="number"
              step="0.01"
              min="0"
              required
              inputMode="decimal"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
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
              Record + distribute
            </button>
          </div>
        </form>
      </section>

      <div className="mt-6 space-y-3">
        {(pools ?? []).map((p) => {
          const dist = (p.distribution ?? []) as Dist[]
          return (
            <article
              key={p.id}
              className="rounded-xl border border-brand-sage/40 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-forest">
                    {new Date(p.date).toLocaleDateString([], {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-brand-slate">
                    £{Number(p.total_collected).toFixed(2)} collected
                  </p>
                </div>
                <form action={deleteTipPool.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="text-xs text-brand-amber hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </div>
              <ul className="mt-3 divide-y divide-brand-sage/30 text-sm">
                {dist.map((d) => (
                  <li
                    key={d.user_id}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-brand-forest">
                      {staffNameById.get(d.user_id) ?? 'Unknown'}
                      <span className="ml-2 text-xs text-brand-slate">
                        {d.hours.toFixed(2)} h
                      </span>
                    </span>
                    <span className="font-mono text-brand-forest">
                      £{d.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              {p.notes && (
                <p className="mt-2 text-xs text-brand-slate">{p.notes}</p>
              )}
            </article>
          )
        })}
        {(pools?.length ?? 0) === 0 && (
          <p className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No tip pools recorded yet.
          </p>
        )}
      </div>
    </main>
  )
}
