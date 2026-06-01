'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/handbook')
  return session
}

function parse(formData: FormData) {
  const sortStr = String(formData.get('sort_order') ?? '0').trim()
  return {
    title: String(formData.get('title') ?? '').trim(),
    category: String(formData.get('category') ?? '').trim() || null,
    body: String(formData.get('body') ?? ''),
    sort_order: Number.isFinite(Number(sortStr)) ? Number(sortStr) : 0,
  }
}

export async function createArticle(formData: FormData) {
  const session = await requireOwner()
  const payload = parse(formData)
  if (!payload.title) {
    redirect('/handbook/new?error=Title+is+required')
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('handbook_articles')
    .insert({ ...payload, active: true, created_by: session.profileId })
    .select('id')
    .single()
  if (error || !data) {
    redirect(
      `/handbook/new?error=${encodeURIComponent(error?.message ?? 'Failed')}`,
    )
  }
  revalidatePath('/handbook')
  redirect(`/handbook/${data.id}?notice=Article+added`)
}

export async function updateArticle(id: string, formData: FormData) {
  await requireOwner()
  const payload = parse(formData)
  if (!payload.title) {
    redirect(`/handbook/${id}/edit?error=Title+is+required`)
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('handbook_articles')
    .update(payload)
    .eq('id', id)
  if (error) {
    redirect(
      `/handbook/${id}/edit?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath('/handbook')
  revalidatePath(`/handbook/${id}`)
  redirect(`/handbook/${id}?notice=Saved`)
}

async function setActive(id: string, active: boolean) {
  await requireOwner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('handbook_articles')
    .update({ active })
    .eq('id', id)
  if (error) {
    redirect(`/handbook/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/handbook')
  revalidatePath(`/handbook/${id}`)
  redirect(
    `/handbook/${id}?notice=${active ? 'Published' : 'Hidden+from+everyone'}`,
  )
}
export async function hideArticle(id: string) {
  await setActive(id, false)
}
export async function publishArticle(id: string) {
  await setActive(id, true)
}

export async function deleteArticle(id: string) {
  await requireOwner()
  const admin = createAdminClient()

  // Storage cleanup before the row goes (cascade handles the rows themselves)
  const { data: attachments } = await admin
    .from('handbook_attachments')
    .select('storage_path')
    .eq('article_id', id)
  if (attachments && attachments.length > 0) {
    await admin.storage
      .from('handbook-files')
      .remove(attachments.map((a) => a.storage_path))
  }

  const { error } = await admin
    .from('handbook_articles')
    .delete()
    .eq('id', id)
  if (error) {
    redirect(`/handbook/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/handbook')
  redirect('/handbook?notice=Deleted')
}

export async function uploadAttachment(
  articleId: string,
  formData: FormData,
) {
  const session = await requireOwner()
  const file = formData.get('file')
  const label = String(formData.get('label') ?? '').trim() || null

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/handbook/${articleId}/edit?error=Pick+a+file+to+upload`)
  }
  if (file.size > 25 * 1024 * 1024) {
    redirect(`/handbook/${articleId}/edit?error=File+too+large+(max+25+MB)`)
  }

  const admin = createAdminClient()
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase()
  const storagePath = `${articleId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await admin.storage
    .from('handbook-files')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
    })
  if (uploadError) {
    redirect(
      `/handbook/${articleId}/edit?error=${encodeURIComponent(uploadError.message)}`,
    )
  }

  const { error: insertError } = await admin
    .from('handbook_attachments')
    .insert({
      article_id: articleId,
      filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_path: storagePath,
      label,
      uploaded_by: session.profileId,
    })
  if (insertError) {
    await admin.storage.from('handbook-files').remove([storagePath])
    redirect(
      `/handbook/${articleId}/edit?error=${encodeURIComponent(insertError.message)}`,
    )
  }

  revalidatePath(`/handbook/${articleId}`)
  revalidatePath(`/handbook/${articleId}/edit`)
  redirect(`/handbook/${articleId}/edit?notice=File+uploaded`)
}

export async function deleteAttachment(
  articleId: string,
  attachmentId: string,
) {
  await requireOwner()
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('handbook_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle()

  if (row?.storage_path) {
    await admin.storage.from('handbook-files').remove([row.storage_path])
  }

  const { error } = await admin
    .from('handbook_attachments')
    .delete()
    .eq('id', attachmentId)
  if (error) {
    redirect(
      `/handbook/${articleId}/edit?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath(`/handbook/${articleId}`)
  revalidatePath(`/handbook/${articleId}/edit`)
  redirect(`/handbook/${articleId}/edit?notice=File+removed`)
}

/** Returns short-lived signed URLs for the article's attachments. */
export async function signedAttachmentUrls(articleId: string): Promise<
  Array<{
    id: string
    filename: string
    mime_type: string | null
    size_bytes: number | null
    label: string | null
    url: string | null
  }>
> {
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('handbook_attachments')
    .select('id, filename, mime_type, size_bytes, label, storage_path')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })

  const results: Array<{
    id: string
    filename: string
    mime_type: string | null
    size_bytes: number | null
    label: string | null
    url: string | null
  }> = []
  for (const r of rows ?? []) {
    const { data } = await admin.storage
      .from('handbook-files')
      .createSignedUrl(r.storage_path, 60 * 60)
    results.push({
      id: r.id,
      filename: r.filename,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      label: r.label,
      url: data?.signedUrl ?? null,
    })
  }
  return results
}
