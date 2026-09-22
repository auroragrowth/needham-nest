import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  daysBetween,
  formatDay,
  getMySignoff,
  londonToday,
  SIGNOFF_PATH,
} from '@/lib/handbook/signoff'
import { confirmHandbookRead, signHandbook } from '@/lib/handbook/signoff-actions'
import { PendingButton } from '@/components/shared/PendingButton'
import { SignaturePad } from '@/components/shared/SignaturePad'

export default async function HandbookSignoffPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(SIGNOFF_PATH)}`)

  const mine = await getMySignoff(session.profileId)
  const today = londonToday()

  if (!mine) {
    return (
      <main className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-2 text-2xl font-semibold text-brand-forest">Handbook sign-off</h1>
        <p className="mt-4 rounded-xl border border-brand-sage/40 bg-white p-5 text-sm text-brand-slate">
          You don&apos;t have a handbook sign-off to do right now.
        </p>
      </main>
    )
  }

  const { round, row, articles, readIds } = mine
  const readCount = articles.filter((a) => readIds.has(a.id)).length
  const allRead = articles.length > 0 && readCount === articles.length
  const daysLeft = daysBetween(today, round.due_on)
  const pct = articles.length ? Math.round((readCount / articles.length) * 100) : 0

  const grouped = new Map<string, typeof articles>()
  for (const a of articles) {
    const k = a.category ?? 'General'
    grouped.set(k, [...(grouped.get(k) ?? []), a])
  }

  return (
    <main className="mx-auto max-w-md pb-10">
      <BackLink />
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Read and sign the handbook
      </h1>

      {row.signed_at ? (
        <p className="mt-1 text-sm text-brand-teal-deep">All done. Thank you.</p>
      ) : (
        <p className="mt-1 text-sm text-brand-slate">
          Please finish by <strong className="text-brand-forest">{formatDay(round.due_on)}</strong>
          {' · '}
          {daysLeft > 1
            ? `${daysLeft} days left`
            : daysLeft === 1
              ? 'due tomorrow'
              : daysLeft === 0
                ? 'due today'
                : <span className="font-semibold text-brand-amber">{-daysLeft} day{daysLeft === -1 ? '' : 's'} overdue</span>}
        </p>
      )}

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

      {row.signed_at ? (
        <section className="mt-6 rounded-2xl border-2 border-brand-teal-deep/40 bg-white p-5">
          <p className="text-sm text-brand-slate">Signed by</p>
          <p className="text-lg font-semibold text-brand-forest">{row.signed_name}</p>
          {row.signature_data && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.signature_data}
              alt={`Signature of ${row.signed_name}`}
              className="mt-3 h-24 w-full rounded-lg border border-brand-sage/40 object-contain"
            />
          )}
          <p className="mt-3 text-sm text-brand-slate">
            Dated {row.signed_on ? formatDay(row.signed_on) : ''}
          </p>
          <Link
            href="/handbook"
            className="mt-4 inline-block text-sm text-brand-amber hover:underline"
          >
            You can still read the handbook any time →
          </Link>
        </section>
      ) : (
        <>
          {/* Step 1 — read every section */}
          <section className="mt-6">
            <StepTitle n={1} done={allRead} title="Read every section" />
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-sage/30">
              <div className="h-full bg-brand-teal-deep" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-brand-slate">
              {readCount} of {articles.length} read. Tap each one to open it. It ticks off when you do.
            </p>

            <div className="mt-4 space-y-4">
              {Array.from(grouped.entries()).map(([category, list]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                    {category}
                  </h3>
                  <ul className="mt-2 divide-y divide-brand-sage/30 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
                    {list.map((a) => {
                      const done = readIds.has(a.id)
                      return (
                        <li key={a.id}>
                          <Link
                            href={`/handbook/${a.id}`}
                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-sage/5"
                          >
                            <span className="flex items-center gap-3">
                              <span
                                aria-hidden
                                className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-sm ${
                                  done
                                    ? 'border-brand-teal-deep bg-brand-teal-deep text-white'
                                    : 'border-brand-sage text-transparent'
                                }`}
                              >
                                ✓
                              </span>
                              <span className={done ? 'text-brand-slate' : 'font-medium text-brand-forest'}>
                                {a.title}
                              </span>
                            </span>
                            <span className="text-brand-amber">{done ? '' : 'Read →'}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Step 2 — I have read it */}
          <section className="mt-8">
            <StepTitle n={2} done={Boolean(row.read_confirmed_at)} title="Confirm you've read it" />
            {row.read_confirmed_at ? (
              <p className="mt-2 text-sm text-brand-teal-deep">You confirmed you&apos;ve read it ✓</p>
            ) : (
              <form action={confirmHandbookRead} className="mt-3">
                <PendingButton
                  className={`w-full rounded-xl px-4 py-4 text-lg font-semibold ${
                    allRead
                      ? 'bg-brand-forest text-brand-cream hover:bg-brand-olive'
                      : 'cursor-not-allowed bg-brand-sage/30 text-brand-slate'
                  }`}
                >
                  I have read it
                </PendingButton>
                {!allRead && (
                  <p className="mt-2 text-xs text-brand-slate">
                    This unlocks once you&apos;ve opened all {articles.length} sections.
                  </p>
                )}
              </form>
            )}
          </section>

          {/* Step 3 — sign and date */}
          {row.read_confirmed_at && (
            <section className="mt-8">
              <StepTitle n={3} done={false} title="Sign and date" />
              <form action={signHandbook} className="mt-3 space-y-4 rounded-2xl border border-brand-sage/40 bg-white p-5">
                <p className="text-sm text-brand-forest">
                  I confirm I have read and understood The Needham Nest staff handbook and
                  agree to follow it.
                </p>
                <label className="block">
                  <span className="text-sm font-medium text-brand-forest">Full name</span>
                  <input
                    name="signed_name"
                    required
                    minLength={3}
                    autoComplete="name"
                    defaultValue={session.name}
                    className="mt-1 w-full rounded-lg border border-brand-sage/60 px-3 py-2 text-brand-forest"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-brand-forest">Date</span>
                  <input
                    type="date"
                    name="signed_on"
                    required
                    defaultValue={today}
                    min={today}
                    max={today}
                    className="mt-1 w-full rounded-lg border border-brand-sage/60 px-3 py-2 text-brand-forest"
                  />
                </label>
                <div>
                  <span className="text-sm font-medium text-brand-forest">Signature</span>
                  <div className="mt-1">
                    <SignaturePad name="signature_data" />
                  </div>
                </div>
                <PendingButton className="w-full rounded-xl bg-brand-forest px-4 py-4 text-lg font-semibold text-brand-cream hover:bg-brand-olive">
                  Sign and submit
                </PendingButton>
              </form>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function BackLink() {
  return (
    <Link href="/" className="text-sm text-brand-amber hover:underline">
      ← Home
    </Link>
  )
}

function StepTitle({ n, done, title }: { n: number; done: boolean; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-forest">
      <span
        className={`flex size-7 items-center justify-center rounded-full text-sm ${
          done ? 'bg-brand-teal-deep text-white' : 'bg-brand-amber text-brand-forest'
        }`}
      >
        {done ? '✓' : n}
      </span>
      {title}
    </h2>
  )
}
