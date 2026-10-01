import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { hasPermission, type StaffFeature } from '@/lib/permissions'
import { FeedbackBanner } from '@/components/shared/FeedbackBanner'
import { BreakBanner } from '@/components/shared/BreakBanner'
import { HandbookSignoffBanner } from '@/components/shared/HandbookSignoffBanner'
import { SECTIONS, type SectionKey } from '@/lib/sections'

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
    { data: profile },
    { count: handoverToday },
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
      .from('profiles')
      .select('permissions')
      .eq('id', session.profileId)
      .maybeSingle(),
    admin
      .from('handover_notes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfTodayIso()),
  ])

  const perms = (profile?.permissions ?? null) as Record<string, boolean> | null
  const can = (feature: StaffFeature) => hasPermission(session.role, perms, feature)

  const totalAppliances = appliances?.length ?? 0
  const loggedApplianceIds = new Set(
    (todaysTemps ?? []).map((t) => t.appliance_id),
  )
  const tempsRemaining = Math.max(0, totalAppliances - loggedApplianceIds.size)

  const totalTasks = tasks?.length ?? 0
  const doneTaskIds = new Set((todaysLogs ?? []).map((l) => l.task_id))
  const tasksRemaining = Math.max(0, totalTasks - doneTaskIds.size)

  const isOnShift = Boolean(openShift)
  const notesToday = handoverToday ?? 0

  return (
    <main className="mx-auto max-w-2xl">
      <p className="text-sm text-brand-slate">
        Hi {session.name}. Tap what you need.
      </p>

      {params.notice && (
        <p className="mt-3 rounded border border-brand-teal bg-white p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-3 rounded border border-people bg-people-tint p-3 text-sm text-people-ink">
          {params.error}
        </p>
      )}

      <BreakBanner profileId={session.profileId} />

      <HandbookSignoffBanner profileId={session.profileId} />

      <FeedbackBanner />

      <Section section="people">
        {can('clock') && (
          <HubTile
            section="people"
            href="/staff/clock"
            title="Clock in/out"
            status={isOnShift ? 'On shift' : 'Off shift'}
            todo={false}
          />
        )}
        <HubTile
          section="people"
          href="/staff/rota"
          title="Today's rota"
          status="Who's on today, and your next shifts"
          todo={false}
        />
        <HubTile
          section="people"
          href="/staff/handover"
          title="Handover notes"
          status={
            notesToday === 0
              ? 'Nothing left today'
              : `${notesToday} note${notesToday === 1 ? '' : 's'} today — read before you start`
          }
          todo={notesToday > 0}
        />
      </Section>

      <Section section="compliance">
        <HubTile
          section="compliance"
          href="/staff/allergens"
          title="Allergen matrix"
          status="Tap a dish, see what's in it"
          todo={false}
        />
        {can('temperatures') && (
          <HubTile
            section="compliance"
            href="/staff/temperatures"
            title="Fridge temps"
            status={
              totalAppliances === 0
                ? 'No appliances'
                : tempsRemaining === 0
                  ? 'All logged today'
                  : `${tempsRemaining}/${totalAppliances} to log`
            }
            todo={tempsRemaining > 0}
          />
        )}
        {can('checklist') && (
          <HubTile
            section="compliance"
            href="/staff/checklist"
            title="Cleaning checklists"
            status={
              totalTasks === 0
                ? 'No tasks'
                : tasksRemaining === 0
                  ? 'All done today'
                  : `${tasksRemaining}/${totalTasks} to tick off`
            }
            todo={tasksRemaining > 0}
          />
        )}
        <HubTile
          section="compliance"
          href="/staff/accident"
          title="Accident book"
          status="Slip, burn, customer trip — log it"
          todo={false}
        />
        <HubTile
          section="compliance"
          href="/staff/eho"
          title="EHO pack"
          status="Records and risk assessments, for an inspector"
          todo={false}
        />
      </Section>

      <Section section="stock">
        <HubTile
          section="stock"
          href="/stock"
          title="Stock counts"
          status="Count, move and add stock"
          todo={false}
        />
        <HubTile
          section="stock"
          href="/stock/goods-in"
          title="Goods in"
          status="A delivery has arrived — book it in"
          todo={false}
        />
        {can('wastage') && (
          <HubTile
            section="stock"
            href="/staff/wastage"
            title="Wastage"
            status="Log it before you clock out"
            todo={false}
          />
        )}
        <HubTile
          section="stock"
          href="/shopping-list"
          title="Shopping list"
          status="Add what we need"
          todo={false}
        />
        <HubTile
          section="stock"
          href="/invoices"
          title="Invoice or receipt"
          status="Photo it and send it in"
          todo={false}
        />
      </Section>

      <nav className="mt-10 border-t border-brand-sage pt-4 text-sm text-brand-slate">
        <span className="font-semibold text-brand-forest">Me:</span>{' '}
        <MeLink href="/staff/availability">Availability</MeLink> ·{' '}
        <MeLink href="/staff/leave">Leave</MeLink> ·{' '}
        <MeLink href="/me/profile">My profile</MeLink> ·{' '}
        <MeLink href="/handbook">Handbook</MeLink>
      </nav>
    </main>
  )
}

/** One coloured section of the hub. Its colour carries on into every page inside it. */
function Section({ section, children }: { section: SectionKey; children: React.ReactNode }) {
  const s = SECTIONS[section]
  return (
    <section className="mt-7">
      <h2 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] ${s.heading}`}>
        <span className={`inline-block h-3 w-3 rounded-full ${s.bar}`} aria-hidden />
        {s.label}
      </h2>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function HubTile({
  section,
  href,
  title,
  status,
  todo,
}: {
  section: SectionKey
  href: string
  title: string
  status: string
  /** Something still to do today: the status reads bold. */
  todo: boolean
}) {
  const s = SECTIONS[section]
  return (
    <Link
      href={href}
      className={`block rounded-2xl border-2 p-5 transition active:scale-[0.98] ${s.tile}`}
    >
      <h3 className={`text-lg font-semibold ${s.ink}`}>{title}</h3>
      <p className={`mt-1 text-sm ${todo ? `font-semibold ${s.ink}` : 'text-brand-slate'}`}>
        {status}
      </p>
    </Link>
  )
}

function MeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-brand-forest underline underline-offset-2">
      {children}
    </Link>
  )
}
