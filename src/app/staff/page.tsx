import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function StaffHub() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: openShift },
    { data: appliances },
    { data: todaysTemps },
    { data: tasks },
    { data: todaysLogs },
    { count: stockItemsCount },
  ] = await Promise.all([
    admin
      .from('time_logs')
      .select('id, clock_in')
      .eq('user_id', session.profileId)
      .is('clock_out', null)
      .maybeSingle(),
    admin.from('appliances').select('id').eq('active', true),
    admin
      .from('temperature_logs')
      .select('appliance_id')
      .gte('recorded_at', startOfTodayIso()),
    admin.from('cleaning_tasks').select('id').eq('active', true),
    admin
      .from('cleaning_log')
      .select('task_id')
      .gte('completed_at', startOfTodayIso()),
    admin
      .from('stock_items')
      .select('*', { count: 'exact', head: true })
      .eq('active', true),
  ])

  const totalAppliances = appliances?.length ?? 0
  const loggedApplianceIds = new Set(
    (todaysTemps ?? []).map((t) => t.appliance_id),
  )
  const tempsLogged = loggedApplianceIds.size
  const tempsRemaining = Math.max(0, totalAppliances - tempsLogged)

  const totalTasks = tasks?.length ?? 0
  const doneTaskIds = new Set((todaysLogs ?? []).map((l) => l.task_id))
  const tasksRemaining = Math.max(0, totalTasks - doneTaskIds.size)

  const isOnShift = Boolean(openShift)

  return (
    <main className="mx-auto max-w-md">
      <p className="text-sm text-brand-slate">
        Hi {session.name}. Tap a section to log activity.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HubTile
          href="/staff/clock"
          title="Clock in/out"
          status={isOnShift ? 'On shift' : 'Off shift'}
          accent={isOnShift ? 'on' : 'off'}
        />
        <HubTile
          href="/staff/temperatures"
          title="Temperatures"
          status={
            totalAppliances === 0
              ? 'No appliances'
              : tempsRemaining === 0
                ? 'All logged today'
                : `${tempsRemaining}/${totalAppliances} to log`
          }
          accent={
            totalAppliances === 0 || tempsRemaining === 0 ? 'off' : 'pending'
          }
        />
        <HubTile
          href="/staff/checklist"
          title="Checklist"
          status={
            totalTasks === 0
              ? 'No tasks'
              : tasksRemaining === 0
                ? 'All done today'
                : `${tasksRemaining}/${totalTasks} to tick off`
          }
          accent={
            totalTasks === 0 || tasksRemaining === 0 ? 'off' : 'pending'
          }
        />
        <HubTile
          href="/staff/stock-count"
          title="Stock count"
          status={
            stockItemsCount && stockItemsCount > 0
              ? `${stockItemsCount} item${stockItemsCount === 1 ? '' : 's'} to count`
              : 'No items configured'
          }
          accent="off"
        />
        <HubTile
          href="/staff/wastage"
          title="Wastage"
          status="Tap to log waste"
          accent="off"
        />
      </div>
    </main>
  )
}

function HubTile({
  href,
  title,
  status,
  accent,
}: {
  href: string
  title: string
  status: string
  accent: 'on' | 'off' | 'pending'
}) {
  const accentClass =
    accent === 'on'
      ? 'border-brand-teal/60 bg-brand-teal/10'
      : accent === 'pending'
        ? 'border-brand-amber/60 bg-brand-amber/10'
        : 'border-brand-sage/40 bg-white'

  const statusClass =
    accent === 'on'
      ? 'text-brand-teal-deep'
      : accent === 'pending'
        ? 'text-brand-forest'
        : 'text-brand-slate'

  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 transition active:scale-[0.98] ${accentClass}`}
    >
      <h2 className="text-lg font-semibold text-brand-forest">{title}</h2>
      <p className={`mt-1 text-sm ${statusClass}`}>{status}</p>
    </Link>
  )
}
