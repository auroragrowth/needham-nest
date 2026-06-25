import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function Home() {
  const session = await getSession()
  if (!session) redirect('/login')

  switch (session.role) {
    case 'owner':
      redirect('/owner')
    case 'manager':
      redirect('/manager')
    case 'staff':
      redirect('/staff')
    case 'payroll':
      redirect('/payroll')
    default:
      redirect('/login?error=Unknown+role')
  }
}
