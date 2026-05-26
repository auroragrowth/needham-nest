import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { setOwnPin } from './actions'

export default async function OwnerMePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('name, pin_hash')
    .eq('id', session.profileId)
    .maybeSingle()

  const hasPin = Boolean(profile?.pin_hash)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {hasPin ? 'Change your PIN' : 'Set your PIN'}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Your PIN is what you tap at <code>/login</code> for daily sign-in. Must
        be 4 digits and unique among active users.
      </p>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={setOwnPin}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="pin"
            className="block text-sm font-medium text-brand-forest"
          >
            New 4-digit PIN
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="pin"
            name="pin"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            autoComplete="off"
            placeholder="••••"
            className="mt-1 w-32 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.4em] text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          {hasPin ? 'Update PIN' : 'Set PIN'}
        </button>
      </form>
    </main>
  )
}
