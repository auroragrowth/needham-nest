import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'manager') redirect('/')

  return (
    <div data-role="manager" className="min-h-screen">
      <RoleHeader role="manager" name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
