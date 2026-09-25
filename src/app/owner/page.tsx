import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { capturePendingCount } from '@/lib/invoice-capture/client'

/** How long since clocking in, e.g. "2h 15m". */
function onShiftFor(clockIn: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')

  const admin = createAdminClient()

  const [
    { data: settings },
    { count: applianceCount },
    { count: taskCount },
    invoicesPending,
  ] = await Promise.all([
    session.authUserId
      ? admin
          .from('settings')
          .select('company_name')
          .eq('user_id', session.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    admin
      .from('appliances')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    admin
      .from('cleaning_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    // Photos in the till not yet read into expenses. Null when the till cannot
    // be reached — the rest of the dashboard carries on.
    capturePendingCount(),
  ])

  const onboarded = Boolean(settings?.company_name)
  const [{ data: ownerProfile }, { data: myOpenShift }] = await Promise.all([
    admin
      .from('profiles')
      .select('pin_hash, on_rota')
      .eq('id', session.profileId)
      .maybeSingle(),
    admin
      .from('time_logs')
      .select('clock_in')
      .eq('user_id', session.profileId)
      .is('clock_out', null)
      .maybeSingle(),
  ])
  const hasPin = Boolean(ownerProfile?.pin_hash)
  // An owner who works shifts (on the rota) clocks in like everyone else.
  // Anyone already clocked in sees the button too, so they can clock out.
  const isOnShift = Boolean(myOpenShift)
  const showClock = Boolean(ownerProfile?.on_rota) || isOnShift
  const shiftLength = isOnShift ? onShiftFor(myOpenShift!.clock_in) : ''

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        {settings?.company_name ?? 'Needham Nest'}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Owner control panel. More sections appear as later phases come online.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      {showClock && (
        <Link
          href="/staff/clock"
          className={`mt-6 flex items-center justify-between rounded-2xl border-2 p-5 transition ${
            isOnShift
              ? 'border-brand-teal-deep bg-brand-teal/10 text-brand-teal-deep hover:bg-brand-teal/20'
              : 'border-brand-forest bg-brand-forest/5 text-brand-forest hover:bg-brand-forest/10'
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>⏱️</span>
            <span>
              <span className="block text-lg font-semibold">{isOnShift ? 'Clock out' : 'Clock in'}</span>
              <span className="block text-sm text-brand-slate">
                {isOnShift ? `On shift · ${shiftLength}` : 'Tap to start your shift'}
              </span>
            </span>
          </span>
          <span className="text-2xl">→</span>
        </Link>
      )}

      {!hasPin && (
        <section className="mt-6 rounded-xl border border-brand-amber/50 bg-brand-amber/10 p-5">
          <h2 className="text-sm font-semibold text-brand-forest">
            Set your PIN for daily sign-in
          </h2>
          <p className="mt-1 text-sm text-brand-forest/80">
            You signed in with email this time. Set a 4-digit PIN and you can
            tap straight in from now on.
          </p>
          <Link
            href="/owner/me"
            className="mt-4 inline-block rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-forest transition-colors hover:bg-brand-amber/90"
          >
            Set my PIN →
          </Link>
        </section>
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

      <Link
        href="/pick-mix"
        className="mt-6 flex items-center justify-between rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-5 text-brand-forest transition hover:bg-brand-amber/20"
      >
        <span className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>🍬</span>
          <span>
            <span className="block text-lg font-semibold">Pick &amp; mix calculator</span>
            <span className="block text-sm text-brand-slate">
              Weigh the bag, get the price (£1.50/100g), enter into till
            </span>
          </span>
        </span>
        <span className="text-2xl text-brand-amber">→</span>
      </Link>

      <Group title="Stock & food">
        <Link
          href="/stock"
          className="flex items-center justify-between rounded-2xl border-2 p-5 transition"
          style={{
            backgroundColor: '#efd9f1',
            borderColor: '#a066a3',
            color: '#3a1f42',
          }}
        >
          <span className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>📦</span>
            <span>
              <span className="block text-lg font-semibold">Stock</span>
              <span className="block text-sm" style={{ color: '#6a4670' }}>
                What we&apos;ve got and where — count, move, add stock and items
              </span>
            </span>
          </span>
          <span className="text-2xl" style={{ color: '#a066a3' }}>→</span>
        </Link>
        <Link
          href="/stock/goods-in"
          className="flex items-center justify-between rounded-2xl border-2 p-5 transition"
          style={{
            backgroundColor: '#efd9f1',
            borderColor: '#a066a3',
            color: '#3a1f42',
          }}
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>📥</span>
            <span className="block text-base font-semibold">Goods In — book in a delivery</span>
          </span>
          <span className="text-2xl" style={{ color: '#a066a3' }}>→</span>
        </Link>
        <Card
          href="/shopping-list"
          title="Shopping list"
          subtitle="Anyone can add — shared between all"
          cta="Open →"
        />
        <Card
          href="/owner/menu"
          title="Menu"
          subtitle="Items, recipes, allergens, GP%"
          cta="Manage →"
        />
        <Card
          href="/owner/allergen-sheet"
          title="Allergen sheet"
          subtitle="Printable menu × allergen matrix"
          cta="Open →"
        />
      </Group>

      <Group title="People & rota">
        <Card
          href="/owner/staff"
          title="People"
          subtitle="Add, edit and sign in staff"
          cta="Manage →"
        />
        <Card
          href="/manager/rota"
          title="Rota"
          subtitle="Plan shifts, see availability, publish to staff"
          cta="Open →"
        />
        <Card
          href="/manager/availability"
          title="Staff availability"
          subtitle="Month overview of who's free each day"
          cta="Open →"
        />
        <Card
          href="/manager/leave"
          title="Leave"
          subtitle="Approve holiday / sick / unpaid"
          cta="Open →"
        />
      </Group>

      <Group title="Food safety & compliance">
        <Card
          href="/admin/checklist"
          title="Daily checklist"
          subtitle={`${taskCount ?? 0} active tasks`}
          cta="Manage →"
        />
        <Card
          href="/owner/appliances"
          title="Appliances"
          subtitle={`${applianceCount ?? 0} active fridges, freezers, hot-holds`}
          cta="Manage →"
        />
        <Card
          href="/owner/compliance/pack"
          title="EHO compliance pack"
          subtitle="Printable PDF for inspectors"
          cta="Generate →"
        />
        <Card
          href="/risk-assessments"
          title="Risk assessments"
          subtitle="Fire, COSHH, slips/trips, manual handling"
          cta="Manage →"
        />
        <Card
          href="/owner/accidents"
          title="Accident book"
          subtitle="Digital accident log + RIDDOR flag"
          cta="Open →"
        />
        <Card
          href="/owner/pest-control"
          title="Pest control"
          subtitle="Visit log for EHO"
          cta="Open →"
        />
        <Card
          href="/admin/training"
          title="Training"
          subtitle="Certificates grouped by course (with file upload)"
          cta="Open →"
        />
        <Card
          href="/handbook/sign-offs"
          title="Handbook sign-offs"
          subtitle="Who has read and signed the handbook"
          cta="Open →"
        />
        <Card
          href="/handbook"
          title="Handbook"
          subtitle="Crib sheets + manuals (everyone reads)"
          cta="Open →"
        />
        <Card
          href="/handbook/files"
          title="Uploaded files"
          subtitle="Every PDF / image you've attached to a handbook article"
          cta="Open →"
        />
      </Group>

      <Group title="Money">
        <Card
          href="/owner/pl"
          title="Profit & Loss"
          subtitle="Month by month: sales, costs, wages, profit"
          cta="Open →"
        />
        <Card
          href="/owner/bank"
          title="Bank"
          subtitle="Monzo import and matching"
          cta="Open →"
        />
        <Card
          href="/owner/expenses"
          title="Expenses"
          subtitle="Everything we've spent, with receipts"
          cta="Open →"
        />
        <Card
          href="/invoices"
          title="📄 Upload invoices & receipts"
          subtitle={
            invoicesPending === null
              ? 'Invoices and receipts · till unavailable'
              : invoicesPending === 0
                ? 'Invoices and receipts · all read into the books'
                : `${invoicesPending} waiting to be read into the books`
          }
          cta="Upload →"
        />
        <Card
          href="/owner/receipts-to-find"
          title="Receipts to find"
          subtitle="Bank payments with no receipt, by supplier and place"
          cta="Open →"
        />
      </Group>

      <Group title="Set-up">
        <Card
          href="/owner/onboarding"
          title="Company settings"
          subtitle={onboarded ? 'Set up' : 'Not yet configured'}
          cta="Edit →"
        />
        <Card
          href="/owner/integrations/sumup"
          title="SumUp"
          subtitle="Till sync + recipe-driven stock depletion"
          cta="Open →"
        />
        <Card
          href="/owner/clock-qr?download=1"
          title="📱 Clock QR posters"
          subtitle="Printable codes: clock in / out, break start / end"
          cta="Download PDF →"
        />
        <Card
          href="/owner/director-loan"
          title="Director's loan"
          subtitle="Balance and entries"
          cta="Open →"
        />
        <Card
          href="/owner/payees"
          title="Payees"
          subtitle="Supplier list, used for bank matching"
          cta="Manage →"
        />
      </Group>

    </main>
  )
}

/** A titled block of cards, so the dashboard reads as a few groups rather than one long list. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">{title}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Card({
  href,
  title,
  subtitle,
  cta,
}: {
  href: string
  title: string
  subtitle: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-brand-sage/40 bg-white p-5 transition-colors hover:border-brand-teal/60 hover:bg-brand-teal/5"
    >
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </h3>
      <p className="mt-2 text-brand-forest">{subtitle}</p>
      <p className="mt-3 text-sm font-medium text-brand-amber">{cta}</p>
    </Link>
  )
}
