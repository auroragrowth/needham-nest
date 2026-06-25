import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/permissions'

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default async function StaffHub({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const params = await searchParams
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
    { data: profile },
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
    admin
      .from('profiles')
      .select('permissions')
      .eq('id', session.profileId)
      .maybeSingle(),
  ])

  const perms = (profile?.permissions ?? null) as Record<string, boolean> | null

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

      {params.notice && (
        <p className="mt-3 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-3 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <Link
        href="/pick-mix"
        className="mt-4 flex items-center justify-between rounded-2xl border-2 border-brand-amber bg-brand-amber/10 p-5 text-brand-forest transition active:scale-[0.99] hover:bg-brand-amber/20"
      >
        <span className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>🍬</span>
          <span>
            <span className="block text-lg font-semibold">Pick &amp; mix</span>
            <span className="block text-sm text-brand-slate">
              Weigh, calculate price, type into till
            </span>
          </span>
        </span>
        <span className="text-2xl text-brand-amber">→</span>
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {hasPermission(session.role, perms, 'clock') && (
          <HubTile
            href="/staff/clock"
            title="Clock in/out"
            status={isOnShift ? 'On shift' : 'Off shift'}
            accent={isOnShift ? 'on' : 'off'}
          />
        )}
        {hasPermission(session.role, perms, 'temperatures') && (
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
        )}
        {hasPermission(session.role, perms, 'checklist') && (
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
        )}
        {hasPermission(session.role, perms, 'stock_count') && (
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
        )}
        {hasPermission(session.role, perms, 'wastage') && (
          <HubTile
            href="/staff/wastage"
            title="Wastage"
            status="Tap to log waste"
            accent="off"
          />
        )}
        <HubTile
          href="/staff/rota"
          title="Your shifts"
          status="Upcoming rota"
          accent="off"
        />
        <HubTile
          href="/staff/availability"
          title="Availability"
          status="When you can work"
          accent="off"
        />
        <HubTile
          href="/me/profile"
          title="My profile"
          status="Update bank, uniform, address"
          accent="off"
        />
        <HubTile
          href="/staff/me/payslips"
          title="My payslips"
          status="Weekly slips + pay status"
          accent="off"
        />
        <HubTile
          href="/staff/receipts"
          title="Snap a receipt"
          status="Upload a photo, AI reads it"
          accent="off"
        />
        <HubTile
          href="/staff/accident"
          title="Accident report"
          status="Slip, burn, customer trip — log it"
          accent="off"
        />
        <HubTile
          href="/staff/leave"
          title="Leave"
          status="Request holiday / sick"
          accent="off"
        />
        <HubTile
          href="/handbook"
          title="Handbook"
          status="Crib sheets + manuals"
          accent="off"
        />
        <HubTile
          href="/shopping-list"
          title="Shopping list"
          status="Add what we need"
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
