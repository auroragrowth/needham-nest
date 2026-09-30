import Link from 'next/link'
import { requireStaffFeature } from '@/lib/permissions'
import { syncCashUpTick, tillCashUpUrl } from '@/lib/till/cash-up'

/**
 * Where the closing list sends whoever is cashing up.
 *
 * The counting itself happens on the till — it has the drawer, the printer and
 * the envelope slip. This page says whether it has been done yet, and ticks the
 * closing job off as soon as it has, so nobody has to remember to come back.
 */
export default async function StaffCashUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await requireStaffFeature('checklist')
  const params = await searchParams
  const state = await syncCashUpTick(session.profileId)
  const tillUrl = tillCashUpUrl()

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff/checklist"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Closing list
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Cashing up
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Counted on the till. This job ticks itself off when it&apos;s done.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      {state.cashedUp ? (
        <div className="mt-6 rounded-2xl border border-brand-teal/40 bg-brand-teal/10 p-5">
          <p className="font-medium text-brand-forest">
            ✓ Done for today
          </p>
          <p className="mt-1 text-sm text-brand-teal-deep">
            Counted{state.by ? ` by ${state.by}` : ''}
            {state.at
              ? ` at ${new Date(state.at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : ''}
            . The closing list is ticked off.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-5">
          <p className="font-medium text-brand-forest">
            {state.asked ? 'Not counted yet' : 'Count the drawer on the till'}
          </p>
          <p className="mt-1 text-sm text-brand-forest">
            {state.asked
              ? 'The till hasn’t had tonight’s count yet.'
              : 'The till can’t be reached from here, so tick this off yourself once the drawer is counted and the envelope is in the safe.'}
          </p>
        </div>
      )}

      <ol className="mt-6 space-y-3 text-sm text-brand-forest">
        {[
          'On the till, tap Cash up.',
          'Count the drawer and type how many of each coin and note there are. Put 0 where there are none.',
          'The till works out what goes in the envelope and what stays in as the £100 float.',
          'Put the day and date on the front of the envelope, sign across the seal, and put it in the safe.',
        ].map((step, i) => (
          <li
            key={step}
            className="flex gap-3 rounded-xl border border-brand-sage/40 bg-white p-4"
          >
            <span className="font-semibold text-brand-teal-deep">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {tillUrl && !state.cashedUp && (
        <a
          href={tillUrl}
          className="mt-4 block rounded-xl border-2 border-brand-teal bg-brand-teal/10 px-4 py-3 text-center text-sm font-semibold text-brand-teal-deep transition active:scale-[0.98] hover:bg-brand-teal/20"
        >
          Open the cash-up on the till →
        </a>
      )}
    </main>
  )
}
