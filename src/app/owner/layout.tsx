import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { requireDob } from '@/lib/auth/dob-gate'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  await requireDob(session.profileId)

  return (
    <div data-role="owner" className="min-h-screen">
      <RoleHeader role="owner" name={session.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
