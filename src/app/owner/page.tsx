import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')

  const admin = createAdminClient()

  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [
    { data: settings },
    { count: staffCount },
    { count: applianceCount },
    { count: taskCount },
    { count: stockCount },
    { data: expenses90 },
    { data: takings90 },
    { data: parItems },
    { data: allPlacements },
  ] = await Promise.all([
    session.authUserId
      ? admin
          .from('settings')
          .select('company_name')
          .eq('user_id', session.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'staff')
      .eq('active', true),
    admin
      .from('appliances')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    admin
      .from('cleaning_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    admin
      .from('stock_items')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
    admin.from('expenses').select('amount').gte('date', since90),
    admin.from('takings').select('amount').gte('date', since90),
    admin
      .from('stock_items')
      .select('id, name, par_level')
      .eq('active', true)
      .not('par_level', 'is', null),
    admin.from('stock_placements').select('stock_item_id, quantity'),
  ])

  // Below-par: whole-shop total per item ≤ par level
  const totalByItem = new Map<string, number>()
  for (const p of allPlacements ?? []) {
    totalByItem.set(
      p.stock_item_id,
      (totalByItem.get(p.stock_item_id) ?? 0) + Number(p.quantity),
    )
  }
  const belowPar = (parItems ?? []).filter(
    (i) => (totalByItem.get(i.id) ?? 0) <= Number(i.par_level),
  )

  const expenseTotal90 = (expenses90 ?? []).reduce(
    (a, r) => a + Number(r.amount ?? 0),
    0,
  )
  const takingsTotal90 = (takings90 ?? []).reduce(
    (a, r) => a + Number(r.amount ?? 0),
    0,
  )

  const onboarded = Boolean(settings?.company_name)
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('pin_hash')
    .eq('id', session.profileId)
    .maybeSingle()
  const hasPin = Boolean(ownerProfile?.pin_hash)

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

      {belowPar.length > 0 && (
        <Link
          href="/owner/stock/alerts"
          className="mt-4 flex items-center justify-between rounded-xl border-2 border-brand-amber bg-brand-amber/10 p-4 text-brand-forest transition hover:bg-brand-amber/20"
        >
          <div>
            <p className="text-sm font-semibold">
              ⚠️ {belowPar.length} item{belowPar.length === 1 ? '' : 's'} below par
            </p>
            <p className="mt-1 text-xs text-brand-slate">
              {belowPar
                .slice(0, 3)
                .map((i) => i.name)
                .join(' · ')}
              {belowPar.length > 3 ? ` · +${belowPar.length - 3} more` : ''}
            </p>
          </div>
          <span className="text-lg text-brand-amber">→</span>
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

      <Link
        href="/stock/locations"
        className="mt-4 flex items-center justify-between rounded-2xl border-2 p-5 transition"
        style={{
          backgroundColor: '#efd9f1',
          borderColor: '#a066a3',
          color: '#3a1f42',
        }}
      >
        <span className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>📦</span>
          <span>
            <span className="block text-lg font-semibold">Move stock between locations</span>
            <span className="block text-sm" style={{ color: '#6a4670' }}>
              Same view as the staff — pick a fridge, move / receive / adjust
            </span>
          </span>
        </span>
        <span className="text-2xl" style={{ color: '#a066a3' }}>→</span>
      </Link>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card
          href="/owner/staff"
          title="People"
          subtitle={`${staffCount ?? 0} active staff`}
          cta="Manage →"
        />
        <Card
          href="/owner/appliances"
          title="Appliances"
          subtitle={`${applianceCount ?? 0} active fridges, freezers, hot-holds`}
          cta="Manage →"
        />
        <Card
          href="/admin/checklist"
          title="Daily checklist"
          subtitle={`${taskCount ?? 0} active tasks`}
          cta="Manage →"
        />
        <Card
          href="/owner/stock"
          title="Stock items"
          subtitle={`${stockCount ?? 0} active items`}
          cta="Manage →"
        />
        <Card
          href="/owner/stock/overview"
          title="📦 Stock by location"
          subtitle="Every item × every fridge / freezer / store"
          cta="Open →"
        />
        <Card
          href="/owner/stock/alerts"
          title="⚠️ Par alerts"
          subtitle={
            belowPar.length > 0
              ? `${belowPar.length} below par right now`
              : 'All above par'
          }
          cta="Open →"
        />
        <Card
          href="/owner/stock/locations"
          title="Stock locations"
          subtitle="Add / edit fridges, freezers, storage areas"
          cta="Manage →"
        />
        <Card
          href="/owner/menu"
          title="Menu"
          subtitle="Items, recipes, allergens, GP%"
          cta="Manage →"
        />
        <Card
          href="/owner/suppliers"
          title="Suppliers"
          subtitle="Vendors, delivery days, terms"
          cta="Manage →"
        />
        <Card
          href="/owner/deliveries"
          title="Deliveries"
          subtitle="Record incoming stock + auto-create expense"
          cta="Open →"
        />
        <Card
          href="/owner/order-pad"
          title="Order pad"
          subtitle="Below-par items grouped by supplier"
          cta="Open →"
        />
        <Card
          href="/owner/allergen-sheet"
          title="Allergen sheet"
          subtitle="Printable menu × allergen matrix"
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
        <Card
          href="/manager/timesheets"
          title="Timesheets"
          subtitle="Hours from clock in/out"
          cta="Open →"
        />
        <Card
          href="/owner/payslips"
          title="Payslips"
          subtitle="Per-staff shift list + gross totals (printable)"
          cta="Open →"
        />
        <Card
          href="/owner/payroll-runs"
          title="🏦 Payroll runs + HMRC pot"
          subtitle="Track weekly + monthly Sage runs. What to put aside."
          cta="Open →"
        />
        <Card
          href="/manager/staffing-cost/history"
          title="Staffing cost history"
          subtitle="Day-by-day totals with running cumulative"
          cta="Open →"
        />
        <Card
          href="/owner/staff-costs/week"
          title="Weekly staff costs"
          subtitle="Matrix: each person × each day, week + running totals"
          cta="Open →"
        />
        <Card
          href="/shopping-list"
          title="Shopping list"
          subtitle="Anyone can add — shared between all"
          cta="Open →"
        />
        <Card
          href="/owner/compliance/pack"
          title="EHO compliance pack"
          subtitle="Printable PDF for inspectors"
          cta="Generate →"
        />
        <Card
          href="/owner/clock-qr?download=1"
          title="📱 Clock QR posters"
          subtitle="Printable codes: clock in / out, break start / end"
          cta="Download PDF →"
        />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Finance
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Card
          href="/owner/takings"
          title="Takings"
          subtitle={`£${takingsTotal90.toFixed(2)} (90d)`}
          cta="Open →"
        />
        <Card
          href="/owner/expenses"
          title="Expenses"
          subtitle={`£${expenseTotal90.toFixed(2)} (90d)`}
          cta="Open →"
        />
        <Card
          href="/owner/payees"
          title="Payees"
          subtitle="Suppliers + vendors"
          cta="Manage →"
        />
        <Card
          href="/owner/director-loan"
          title="Director's loan"
          subtitle="DL account balance + entries"
          cta="Open →"
        />
        <Card
          href="/owner/tax-pot"
          title="Tax pot"
          subtitle="CT estimate + allocations"
          cta="Open →"
        />
        <Card
          href="/owner/invoices"
          title="Invoices"
          subtitle="B2B catering + function bookings"
          cta="Open →"
        />
        <Card
          href="/owner/customers"
          title="Customers"
          subtitle="Invoice recipients"
          cta="Manage →"
        />
        <Card
          href="/owner/bank"
          title="Bank"
          subtitle="Monzo CSV import + reconciliation"
          cta="Open →"
        />
        <Card
          href="/owner/receipts"
          title="📸 Snap a receipt"
          subtitle="One photo, auto-scanned, auto-reconciled"
          cta="Open →"
        />
        <Card
          href="/owner/invoices-upload"
          title="Bulk invoices"
          subtitle="Drop many PDFs / photos at once"
          cta="Upload →"
        />
        <Card
          href="/owner/invoices-reconcile"
          title="Invoice reconciliation"
          subtitle="Flag unmatched, post to director's loan"
          cta="Open →"
        />
        <Card
          href="/owner/pl"
          title="Profit & Loss"
          subtitle="Period view: takings vs expenses, net after CT"
          cta="Open →"
        />
        <Card
          href="/owner/wages"
          title="Wages"
          subtitle="Generate gross wages from clock-ins"
          cta="Open →"
        />
        <Card
          href="/owner/tips"
          title="Tips (tronc)"
          subtitle="Pool + auto-distribute by hours"
          cta="Open →"
        />
        <Card
          href="/owner/integrations/sumup"
          title="SumUp"
          subtitle="Till sync + recipe-driven stock depletion"
          cta="Open →"
        />
        <Card
          href="/owner/onboarding"
          title="Company settings"
          subtitle={onboarded ? 'Set up' : 'Not yet configured'}
          cta="Edit →"
        />
      </div>
    </main>
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
