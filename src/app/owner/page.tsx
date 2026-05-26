import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('company_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const onboarded = Boolean(settings?.company_name)

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Owner dashboard
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Phase 0 placeholder — financials, P&amp;L, and tax pot land in Phase 2.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      {!onboarded && (
        <section className="mt-6 rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-5">
          <h2 className="text-sm font-semibold text-brand-forest">
            Finish setting up the café
          </h2>
          <p className="mt-1 text-sm text-brand-forest/80">
            Add your company details, bank, and corporation tax rate before the
            financial features come online.
          </p>
          <Link
            href="/owner/onboarding"
            className="mt-4 inline-block rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-forest transition-colors hover:bg-brand-amber/90"
          >
            Open onboarding →
          </Link>
        </section>
      )}

      {onboarded && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-forest">Settings</h2>
          <p className="mt-1 text-sm text-brand-slate">
            Company set up as{' '}
            <strong className="text-brand-forest">
              {settings!.company_name}
            </strong>
            .{' '}
            <Link
              href="/owner/onboarding"
              className="font-medium text-brand-amber hover:underline"
            >
              Edit
            </Link>
          </p>
        </section>
      )}
    </main>
  )
}
