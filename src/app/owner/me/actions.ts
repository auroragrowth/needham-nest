'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export async function setOwnPin(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const pin = String(formData.get('pin') ?? '').trim()
  if (!/^\d{4}$/.test(pin)) {
    redirect('/owner/me?error=PIN+must+be+exactly+4+digits')
  }

  const admin = createAdminClient()

  // Uniqueness: any other active profile with this PIN?
  const { data: match } = await admin.rpc('verify_pin', { p_pin: pin })
  if (
    Array.isArray(match) &&
    match.some(
      (row: { profile_id: string }) => row.profile_id !== session.profileId,
    )
  ) {
    redirect('/owner/me?error=PIN+already+in+use+%E2%80%94+pick+another')
  }

  const { data: hashed, error: hashError } = await admin.rpc('hash_pin', {
    p_pin: pin,
  })
  if (hashError || !hashed) {
    redirect(
      `/owner/me?error=${encodeURIComponent(hashError?.message ?? 'Failed to hash PIN')}`,
    )
  }

  const { error } = await admin
    .from('profiles')
    .update({ pin_hash: String(hashed) })
    .eq('id', session.profileId)

  if (error) {
    redirect(`/owner/me?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner')
  redirect('/owner?notice=PIN+set.+Use+it+for+sign-in+from+now+on.')
}
