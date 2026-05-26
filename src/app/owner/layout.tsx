import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RoleHeader } from '@/components/shared/RoleHeader'

export default async function OwnerLayout({
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

  if (profile?.role !== 'owner') redirect('/')

  return (
    <div data-role="owner" className="min-h-screen">
      <RoleHeader role="owner" name={profile.name} />
      <div className="p-6">{children}</div>
    </div>
  )
}
