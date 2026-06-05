import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  // Owner stays out of the tablet flow (they have /owner/* for management).
  // Staff and Manager both use the tablet — managers wear both hats.
  if (session.role === 'owner') redirect('/owner')

  return (
    <div data-role={session.role} className="min-h-screen">
      <RoleHeader role={session.role} name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
