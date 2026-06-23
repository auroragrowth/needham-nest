import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { addAccident } from '@/lib/compliance/actions'

export const dynamic = 'force-dynamic'

function nowLocalDatetime(): string {
  // datetime-local needs YYYY-MM-DDTHH:MM
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export default async function StaffAccidentPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Tablet
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Accident report
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Log anything — slip, burn, cut, customer trip — as soon as you can.
        It goes straight to Paul. Required by law for EHO.
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
        action={addAccident}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-5"
      >
        <div>
          <label
            htmlFor="occurred_at"
            className="block text-sm font-medium text-brand-forest"
          >
            When did it happen?
          </label>
          <input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            defaultValue={nowLocalDatetime()}
            className="mt-1 w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest"
            style={{
              touchAction: 'manipulation',
              WebkitAppearance: 'none',
              minHeight: '44px',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="person"
            className="block text-sm font-medium text-brand-forest"
          >
            Who was involved?
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="person"
            name="person"
            type="text"
            required
            defaultValue={session.name}
            placeholder="e.g. yourself, a colleague, a customer"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest"
            style={{ minHeight: '44px' }}
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-brand-forest"
          >
            What happened?
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            placeholder="Where, what they were doing, what went wrong, any injuries…"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest"
          />
        </div>

        <div>
          <label
            htmlFor="action_taken"
            className="block text-sm font-medium text-brand-forest"
          >
            Action taken (optional)
          </label>
          <textarea
            id="action_taken"
            name="action_taken"
            rows={3}
            placeholder="First aid, called 111, sent home, cleared the spill, etc."
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-forest">
          <input
            type="checkbox"
            name="riddor_reportable"
            className="h-5 w-5"
          />
          Tick if this seems serious — broken bone, hospital trip, more than 7
          days off work. (Paul will assess and report to HSE if needed.)
        </label>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minHeight: '44px',
          }}
        >
          Submit report
        </button>
      </form>
    </main>
  )
}
