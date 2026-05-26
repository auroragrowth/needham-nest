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
  if (session.role !== 'staff') redirect('/')

  return (
    <div data-role="staff" className="min-h-screen">
      <RoleHeader role="staff" name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
