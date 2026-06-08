'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

export async function saveMyDob(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const dob = String(formData.get('date_of_birth') ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    redirect('/me/dob?error=Pick+a+valid+date')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ date_of_birth: dob })
    .eq('id', session.profileId)

  if (error) {
    redirect(`/me/dob?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  const home =
    session.role === 'owner'
      ? '/owner'
      : session.role === 'manager'
        ? '/manager'
        : '/staff'
  redirect(home)
}
