import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { requireDob } from '@/lib/auth/dob-gate'
import { createAdminClient } from '@/lib/supabase/admin'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Owner + manager use the manager area (rota, leave, compliance,
  // timesheets, cash, wastage). Staff with manager_access=true also pass —
  // covers casual keyholders / supervisors who are HR-classified as staff.
  if (session.role === 'staff') {
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('manager_access')
      .eq('id', session.profileId)
      .maybeSingle()
    if (!data?.manager_access) redirect('/staff')
  }
  await requireDob(session.profileId)

  return (
    <div data-role={session.role} className="min-h-screen">
      <RoleHeader role={session.role} name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
