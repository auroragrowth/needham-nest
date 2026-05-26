import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function ManagerDashboard() {
  const admin = createAdminClient()

  const [
    { count: onShiftNow },
    { count: shiftsToday },
    { data: appliances },
    { data: tempsToday },
  ] = await Promise.all([
    admin
      .from('time_logs')
      .select('*', { count: 'exact', head: true })
      .is('clock_out', null),
    admin
      .from('time_logs')
      .select('*', { count: 'exact', head: true })
      .gte('clock_in', startOfTodayIso()),
    admin.from('appliances').select('id').eq('active', true),
    admin
      .from('temperature_logs')
      .select('appliance_id, in_range')
      .gte('recorded_at', startOfTodayIso()),
  ])

  const totalAppliances = appliances?.length ?? 0
  const loggedAppliances = new Set(
    (tempsToday ?? []).map((t) => t.appliance_id),
  ).size
  const outOfRangeToday = (tempsToday ?? []).filter((t) => !t.in_range).length

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Manager dashboard
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Day-to-day operations. More sections appear as later phases come online.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card
          href="/manager/timesheets"
          title="Timesheets"
          subtitle={`${onShiftNow ?? 0} on shift · ${shiftsToday ?? 0} shifts today`}
          cta="Open →"
        />
        <Card
          href="/manager/compliance"
          title="Temperatures"
          subtitle={
            totalAppliances === 0
              ? 'No appliances configured'
              : `${loggedAppliances}/${totalAppliances} logged today${outOfRangeToday ? ` · ${outOfRangeToday} out of range` : ''}`
          }
          cta="Open →"
          warn={outOfRangeToday > 0}
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
  warn,
}: {
  href: string
  title: string
  subtitle: string
  cta: string
  warn?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-5 transition-colors ${
        warn
          ? 'border-brand-amber/60 bg-brand-amber/10 hover:bg-brand-amber/20'
          : 'border-brand-sage/40 bg-white hover:border-brand-teal/60 hover:bg-brand-teal/5'
      }`}
    >
      <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {title}
      </h3>
      <p className="mt-2 text-brand-forest">{subtitle}</p>
      <p className="mt-3 text-sm font-medium text-brand-amber">{cta}</p>
    </Link>
  )
}
