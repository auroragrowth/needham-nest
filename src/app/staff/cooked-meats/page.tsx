import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { logCookedMeatCheck } from '@/lib/cooked-meats/actions'

export const dynamic = 'force-dynamic'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function CookedMeatsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const admin = createAdminClient()

  // Last 20 checks with staff name for the log
  const { data: recent } = await admin
    .from('cooked_meat_checks')
    .select(
      'id, item_name, temperature, in_range, corrective_action, notes, recorded_at, user_id',
    )
    .order('recorded_at', { ascending: false })
    .limit(20)

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name')
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff/temperatures"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Temperature checks
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Cooked meat check
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        UK law: cooked meat must reach{' '}
        <span className="font-semibold">75 °C or above</span> at the thickest
        part. Probe the centre and log it.
      </p>

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

      <form
        action={logCookedMeatCheck}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-5"
      >
        <div>
          <label
            htmlFor="item_name"
            className="block text-sm font-medium text-brand-forest"
          >
            What are you probing?
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="item_name"
            name="item_name"
            type="text"
            required
            list="cooked-meat-suggestions"
            placeholder="e.g. Chicken curry, Beef chilli, Sausages"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest"
            style={{
              touchAction: 'manipulation',
              WebkitAppearance: 'none',
              minHeight: '44px',
            }}
          />
          <datalist id="cooked-meat-suggestions">
            <option value="Chicken curry" />
            <option value="Beef chilli" />
            <option value="Ham (jacket)" />
            <option value="Bacon (jacket / panini)" />
            <option value="Sausage roll (reheat)" />
            <option value="Sausage (panini)" />
            <option value="Tuna melt (panini)" />
          </datalist>
        </div>

        <div>
          <label
            htmlFor="temperature"
            className="block text-sm font-medium text-brand-forest"
          >
            Core temperature (°C)
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="temperature"
            name="temperature"
            type="number"
            step="0.1"
            min={0}
            max={200}
            required
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-2xl text-brand-forest"
            placeholder="75.0"
          />
          <p className="mt-1 text-xs text-brand-slate">
            Anything under 75 °C needs to go back on and be re-probed.
          </p>
        </div>

        <div>
          <label
            htmlFor="corrective_action"
            className="block text-sm font-medium text-brand-forest"
          >
            Corrective action (only if under 75 °C)
          </label>
          <input
            id="corrective_action"
            name="corrective_action"
            type="text"
            placeholder="e.g. Cooked for a further 3 min and re-probed to 82 °C"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-brand-forest"
          >
            Notes (optional)
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            placeholder="Anything worth remembering"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{ minHeight: '44px' }}
        >
          Log check
        </button>
      </form>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Recent checks
        </h2>
        {(recent?.length ?? 0) === 0 ? (
          <p className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
            No checks logged yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(recent ?? []).map((r) => (
              <li
                key={r.id}
                className={`rounded-xl border p-3 text-sm ${
                  r.in_range
                    ? 'border-brand-teal/40 bg-brand-teal/5'
                    : 'border-brand-amber/60 bg-brand-amber/10'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-brand-forest">
                    {r.item_name}
                  </p>
                  <p
                    className={`font-mono text-lg font-semibold ${
                      r.in_range ? 'text-brand-teal-deep' : 'text-brand-amber'
                    }`}
                  >
                    {Number(r.temperature).toFixed(1)} °C{' '}
                    {r.in_range ? '✓' : '⚠'}
                  </p>
                </div>
                <p className="text-xs text-brand-slate">
                  {fmtWhen(r.recorded_at)} ·{' '}
                  {nameById.get(r.user_id) ?? 'Unknown'}
                </p>
                {r.corrective_action && (
                  <p className="mt-1 text-xs text-brand-forest">
                    ↳ {r.corrective_action}
                  </p>
                )}
                {r.notes && (
                  <p className="mt-1 text-xs text-brand-slate">{r.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
