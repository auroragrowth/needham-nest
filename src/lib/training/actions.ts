'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireOwnerOrManager() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

function parsePayload(formData: FormData) {
  return {
    type: String(formData.get('type') ?? '').trim() || 'other',
    certificate_ref:
      String(formData.get('certificate_ref') ?? '').trim() || null,
    issued_at: String(formData.get('issued_at') ?? '').trim() || null,
    expires_at: String(formData.get('expires_at') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  }
}

export async function addTrainingRecord(
  staffId: string,
  formData: FormData,
) {
  await requireOwnerOrManager()
  const payload = parsePayload(formData)
  const admin = createAdminClient()
  const { error } = await admin
    .from('training_records')
    .insert({ user_id: staffId, ...payload })
  if (error) {
    redirect(
      `/owner/staff/${staffId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath(`/owner/staff/${staffId}`)
  revalidatePath('/owner/training')
  redirect(`/owner/staff/${staffId}?notice=Training+added`)
}

export async function deleteTrainingRecord(
  staffId: string,
  recordId: string,
) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin
    .from('training_records')
    .delete()
    .eq('id', recordId)
  if (error) {
    redirect(
      `/owner/staff/${staffId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath(`/owner/staff/${staffId}`)
  revalidatePath('/owner/training')
  redirect(`/owner/staff/${staffId}?notice=Training+removed`)
}
