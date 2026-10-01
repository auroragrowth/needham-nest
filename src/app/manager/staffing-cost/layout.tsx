import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

/**
 * Wage costs are the owner's: payroll is outsourced, so managers on the tablet
 * have no use for them. The pages stay for the owner until the Hub replaces them.
 */
export default async function StaffingCostLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (session?.role !== 'owner') redirect('/manager')
  return children
}
