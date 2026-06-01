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
