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
  revalidatePath('/admin/training')
  redirect(`/owner/staff/${staffId}?notice=Training+added`)
}

export async function addTrainingFromAdmin(formData: FormData) {
  await requireOwnerOrManager()
  const staffId = String(formData.get('staff_user_id') ?? '').trim()
  if (!staffId) {
    redirect('/admin/training?error=Pick+a+staff+member')
  }
  const payload = parsePayload(formData)
  const admin = createAdminClient()
  const { error } = await admin
    .from('training_records')
    .insert({ user_id: staffId, ...payload })
  if (error) {
    redirect(`/admin/training?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/admin/training')
  revalidatePath(`/owner/staff/${staffId}`)
  redirect('/admin/training?notice=Training+added')
}

export async function deleteTrainingRecord(
  staffId: string,
  recordId: string,
) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  // Best-effort file cleanup
  const { data: rec } = await admin
    .from('training_records')
    .select('document_path')
    .eq('id', recordId)
    .maybeSingle()
  if (rec?.document_path) {
    await admin.storage.from('training-files').remove([rec.document_path])
  }
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
  revalidatePath('/admin/training')
  redirect(`/owner/staff/${staffId}?notice=Training+removed`)
}

export async function deleteTrainingFromAdmin(recordId: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { data: rec } = await admin
    .from('training_records')
    .select('document_path')
    .eq('id', recordId)
    .maybeSingle()
  if (rec?.document_path) {
    await admin.storage.from('training-files').remove([rec.document_path])
  }
  const { error } = await admin
    .from('training_records')
    .delete()
    .eq('id', recordId)
  if (error) {
    redirect(`/admin/training?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/admin/training')
  redirect('/admin/training?notice=Training+removed')
}

// ---------- Files attached to training records ----------

async function ensureTrainingBucket() {
  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (buckets?.some((b) => b.id === 'training-files')) return
  await admin.storage.createBucket('training-files', {
    public: false,
    fileSizeLimit: 52428800,
  })
}

export async function uploadTrainingFile(
  recordId: string,
  formData: FormData,
) {
  await requireOwnerOrManager()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/training?error=Pick+a+file`)
  }
  if (file.size > 50 * 1024 * 1024) {
    redirect(`/admin/training?error=File+too+large+(max+50+MB)`)
  }

  await ensureTrainingBucket()

  const admin = createAdminClient()
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase()
  const storagePath = `${recordId}/${crypto.randomUUID()}.${ext}`

  // If there's already a file, delete it first so we don't orphan it
  const { data: existing } = await admin
    .from('training_records')
    .select('document_path')
    .eq('id', recordId)
    .maybeSingle()
  if (existing?.document_path) {
    await admin.storage.from('training-files').remove([existing.document_path])
  }

  const { error: uploadError } = await admin.storage
    .from('training-files')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
    })
  if (uploadError) {
    redirect(`/admin/training?error=${encodeURIComponent(uploadError.message)}`)
  }

  const { error } = await admin
    .from('training_records')
    .update({ document_path: storagePath })
    .eq('id', recordId)
  if (error) {
    await admin.storage.from('training-files').remove([storagePath])
    redirect(`/admin/training?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/admin/training')
  redirect('/admin/training?notice=File+attached')
}

export async function removeTrainingFile(recordId: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { data: rec } = await admin
    .from('training_records')
    .select('document_path')
    .eq('id', recordId)
    .maybeSingle()
  if (rec?.document_path) {
    await admin.storage.from('training-files').remove([rec.document_path])
  }
  await admin
    .from('training_records')
    .update({ document_path: null })
    .eq('id', recordId)

  revalidatePath('/admin/training')
  redirect('/admin/training?notice=File+removed')
}

export async function signedTrainingUrl(
  recordId: string,
): Promise<string | null> {
  const admin = createAdminClient()
  const { data: rec } = await admin
    .from('training_records')
    .select('document_path')
    .eq('id', recordId)
    .maybeSingle()
  if (!rec?.document_path) return null
  const { data } = await admin.storage
    .from('training-files')
    .createSignedUrl(rec.document_path, 60 * 60)
  return data?.signedUrl ?? null
}
