'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

function s(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? '').trim()
  return raw === '' ? null : raw
}

export async function updateMyProfile(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const payload = {
    phone: s(formData, 'phone'),
    email: s(formData, 'email'),
    pronouns: s(formData, 'pronouns'),
    address_line_1: s(formData, 'address_line_1'),
    address_line_2: s(formData, 'address_line_2'),
    address_city: s(formData, 'address_city'),
    address_postcode:
      s(formData, 'address_postcode')?.toUpperCase() ?? null,
    emergency_contact_name: s(formData, 'emergency_contact_name'),
    emergency_contact_phone: s(formData, 'emergency_contact_phone'),
    medical_conditions: s(formData, 'medical_conditions'),
    medication: s(formData, 'medication'),
    allergies: s(formData, 'allergies'),
    ni_number: s(formData, 'ni_number')?.toUpperCase() ?? null,
    tax_code: s(formData, 'tax_code')?.toUpperCase() ?? null,
    bank_sort_code: s(formData, 'bank_sort_code'),
    bank_account_number: s(formData, 'bank_account_number'),
    uniform_size: s(formData, 'uniform_size'),
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(payload)
    .eq('id', session.profileId)

  if (error) {
    redirect(`/me/profile?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/me/profile')
  revalidatePath('/staff')
  revalidatePath('/owner/staff')
  revalidatePath('/payroll/staff')
  redirect('/me/profile?notice=Profile+updated')
}

export async function uploadMyPhoto(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    redirect('/me/profile?error=Pick+a+photo+to+upload')
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${session.profileId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('staff-photos')
    .upload(storagePath, bytes, { contentType: file.type })
  if (uploadErr) {
    redirect(`/me/profile?error=${encodeURIComponent(uploadErr.message)}`)
  }
  await admin
    .from('profiles')
    .update({ photo_path: storagePath })
    .eq('id', session.profileId)
  revalidatePath('/me/profile')
  redirect('/me/profile?notice=Photo+updated')
}
