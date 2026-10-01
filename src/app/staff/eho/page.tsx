import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { CompliancePack } from '@/components/compliance/CompliancePack'

export const dynamic = 'force-dynamic'

/** The EHO pack on the tablet, read-only, for showing an inspector. */
export default async function StaffEhoPackPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')
  const full = session.role === 'owner' || session.role === 'manager'
  return (
    <CompliancePack
      sp={sp}
      forStaff={!full}
      authUserId={full ? (session.authUserId ?? null) : null}
      backHref="/staff"
    />
  )
}
