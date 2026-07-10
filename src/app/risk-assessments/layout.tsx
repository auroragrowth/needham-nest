import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function RiskAssessmentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div data-role={session.role} className="min-h-screen">
      <RoleHeader role={session.role} name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
