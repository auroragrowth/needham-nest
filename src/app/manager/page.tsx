import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default async function ManagerDashboard() {
  const admin = createAdminClient()
  const session = await getSession()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [
    { count: onShiftNow },
    { count: shiftsToday },
    { data: appliances },
    { data: tempsToday },
    { data: tasks },
    { data: cleanLogsToday },
    { data: wastageWeek },
    { data: myOpenShift },
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
    admin.from('cleaning_tasks').select('id').eq('active', true),
    admin
      .from('cleaning_log')
      .select('task_id')
      .gte('completed_at', startOfTodayIso()),
    admin
      .from('stock_movements')
      .select('quantity, unit_cost')
      .not('wastage_reason', 'is', null)
      .gte('date', sevenDaysAgo),
    session
      ? admin
          .from('time_logs')
          .select('clock_in')
          .eq('user_id', session.profileId)
          .is('clock_out', null)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
  ])

  const isOnShift = Boolean(myOpenShift)
  const shiftDurationMs = isOnShift
    ? Date.now() - new Date(myOpenShift!.clock_in).getTime()
    : 0

  const wastageCostWeek = (wastageWeek ?? []).reduce(
    (a, r) =>
      a +
      (Number(r.quantity ?? 0) || 0) * (Number(r.unit_cost ?? 0) || 0),
    0,
  )
  const wastageEntriesWeek = wastageWeek?.length ?? 0

  const totalAppliances = appliances?.length ?? 0
  const loggedAppliances = new Set(
    (tempsToday ?? []).map((t) => t.appliance_id),
  ).size
  const outOfRangeToday = (tempsToday ?? []).filter((t) => !t.in_range).length

  const totalTasks = tasks?.length ?? 0
  const doneTasks = new Set((cleanLogsToday ?? []).map((l) => l.task_id)).size
  const tasksRemaining = Math.max(0, totalTasks - doneTasks)

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Manager dashboard
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Day-to-day operations. More sections appear as later phases come online.
      </p>

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
            <span className="block text-lg font-semibold">
              {isOnShift ? 'Clock out' : 'Clock in'}
            </span>
            <span className="block text-sm text-brand-slate">
              {isOnShift
                ? `On shift · ${formatDuration(shiftDurationMs)}`
                : 'Tap to start your shift'}
            </span>
          </span>
        </span>
        <span className="text-2xl">→</span>
      </Link>

      <Link
        href="/pick-mix"
        className="mt-4 flex items-center justify-between rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-5 text-brand-forest transition hover:bg-brand-amber/20"
      >
        <span className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>🍬</span>
          <span>
            <span className="block text-lg font-semibold">Pick &amp; mix calculator</span>
            <span className="block text-sm text-brand-slate">
              £1.50 per 100g — type grams, charge the result
            </span>
          </span>
        </span>
        <span className="text-2xl text-brand-amber">→</span>
      </Link>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card
          href="/manager/timesheets"
          title="Timesheets"
          subtitle={`${onShiftNow ?? 0} on shift · ${shiftsToday ?? 0} shifts today`}
          cta="Open →"
        />
        <Card
          href="/me/profile"
          title="My profile"
          subtitle="Update your own details / bank / uniform"
          cta="Open →"
        />
        <Card
          href="/manager/staffing-cost"
          title="Staffing cost"
          subtitle="PAYE baseline + rostered hourly, by day"
          cta="Open →"
        />
        <Card
          href="/manager/rota"
          title="Rota"
          subtitle="Weekly grid + publish to staff"
          cta="Open →"
        />
        <Card
          href="/manager/availability"
          title="Staff availability"
          subtitle="Month overview — who's free each day"
          cta="Open →"
        />
        <Card
          href="/manager/leave"
          title="Leave"
          subtitle="Approve holiday / sick / unpaid"
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
        <Card
          href="/manager/compliance"
          title="Checklist"
          subtitle={
            totalTasks === 0
              ? 'No tasks configured'
              : tasksRemaining === 0
                ? `All ${totalTasks} done today`
                : `${doneTasks}/${totalTasks} done today`
          }
          cta="Open →"
        />
        <Card
          href="/manager/cash"
          title="Cash"
          subtitle="End-of-day count + petty cash"
          cta="Open →"
        />
        <Card
          href="/manager/wastage"
          title="Wastage"
          subtitle={
            wastageEntriesWeek === 0
              ? 'No wastage in last 7 days'
              : `£${wastageCostWeek.toFixed(2)} over ${wastageEntriesWeek} entr${wastageEntriesWeek === 1 ? 'y' : 'ies'} (7d)`
          }
          cta="Open →"
        />
        <Card
          href="/staff"
          title="Tablet tasks"
          subtitle="Clock in/out, temperatures, checklist, stock — same as staff"
          cta="Open →"
        />
        <Card
          href="/admin/checklist"
          title="Checklist admin"
          subtitle="Build + reorder start-up / close-down lists"
          cta="Open →"
        />
        <Card
          href="/admin/training"
          title="Training"
          subtitle="Add records + upload certificates"
          cta="Open →"
        />
        <Card
          href="/shopping-list"
          title="Shopping list"
          subtitle="Shared list — everyone can add"
          cta="Open →"
        />
        <Card
          href="/handbook"
          title="Handbook"
          subtitle="Crib sheets + manuals"
          cta="Open →"
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
