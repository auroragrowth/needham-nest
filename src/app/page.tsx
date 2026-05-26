import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  switch (profile?.role) {
    case 'owner':
      redirect('/owner')
    case 'manager':
      redirect('/manager')
    case 'staff':
      redirect('/staff')
    default:
      redirect('/login?error=Profile+not+found+%E2%80%94+contact+the+owner')
  }
}
