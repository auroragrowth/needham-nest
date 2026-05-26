import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'manager') redirect('/')

  return (
    <div data-role="manager" className="min-h-screen">
      <RoleHeader role="manager" name={profile.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
