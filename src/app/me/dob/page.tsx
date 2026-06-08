import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveMyDob } from './actions'

export default async function CaptureDobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('date_of_birth')
    .eq('id', session.profileId)
    .maybeSingle()

  // Already captured — bounce back to the role home.
  if (profile?.date_of_birth) {
    const home =
      session.role === 'owner'
        ? '/owner'
        : session.role === 'manager'
          ? '/manager'
          : '/staff'
    redirect(home)
  }

  return (
    <main className="mx-auto mt-12 max-w-md p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Quick one before you start
      </h1>
      <p className="mt-2 text-sm text-brand-forest/80">
        Hi {session.name}, we need your date of birth on file so the rota
        applies the correct statutory break rules to your shifts. This is
        a one-off — you won&apos;t be asked again.
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={saveMyDob}
        className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <label
          htmlFor="dob"
          className="block text-sm font-medium text-brand-forest"
        >
          Date of birth
        </label>
        <input
          id="dob"
          name="date_of_birth"
          type="date"
          required
          max="2099-12-31"
          min="1920-01-01"
          className="mt-2 block w-full cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            WebkitAppearance: 'none',
            minHeight: '44px',
          }}
        />
        <button
          type="submit"
          className="mt-6 w-full cursor-pointer rounded-lg bg-brand-forest px-4 py-3 text-base font-semibold text-brand-cream hover:bg-brand-olive"
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minHeight: '44px',
          }}
        >
          Save and continue
        </button>
      </form>
    </main>
  )
}
