import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { CompliancePack } from '@/components/compliance/CompliancePack'

export default async function CompliancePackPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session || (session.role !== 'owner' && session.role !== 'manager')) {
    redirect('/login')
  }
  return (
    <CompliancePack
      sp={sp}
      forStaff={false}
      authUserId={session.authUserId ?? null}
      backHref="/owner"
    />
  )
}
