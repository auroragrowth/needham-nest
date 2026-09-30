import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { requireDob } from '@/lib/auth/dob-gate'
import { RoleHeader } from '@/components/shared/RoleHeader'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Owner stays out of the tablet flow (they have /owner/* for management) —
  // unless they work shifts. An owner on the rota clocks in, takes breaks,
  // ticks the closing list and confirms waste like everyone else, and clocking
  // out sends them through /staff/checklist and /staff/wastage, so bouncing
  // them to /owner here would leave them unable to clock out at all.
  // Staff and Manager both use the tablet — managers wear both hats.
  if (session.role === 'owner') {
    const { data: me } = await createAdminClient()
      .from('profiles')
      .select('on_rota')
      .eq('id', session.profileId)
      .maybeSingle()
    if (!me?.on_rota) redirect('/owner')
  }
  await requireDob(session.profileId)

  return (
    <div data-role={session.role} className="min-h-screen">
      <RoleHeader role={session.role} name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
