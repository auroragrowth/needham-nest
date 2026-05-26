'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { requireStaffFeature } from '@/lib/permissions'

const VALID_FREQ = ['open', 'mid', 'close', 'daily'] as const
type Frequency = (typeof VALID_FREQ)[number]

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

function parseTaskPayload(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const freqRaw = String(formData.get('frequency') ?? '').trim()
  const frequency = (VALID_FREQ as readonly string[]).includes(freqRaw)
    ? (freqRaw as Frequency)
    : null
  const area = String(formData.get('area') ?? '').trim() || null
  const sortOrderStr = String(formData.get('sort_order') ?? '').trim()
  const sort_order = sortOrderStr === '' ? 0 : Number(sortOrderStr)
  return { name, frequency, area, sort_order }
}

export async function createTask(formData: FormData) {
  await requireOwner()
  const { name, frequency, area, sort_order } = parseTaskPayload(formData)
  if (!name) redirect('/owner/checklist/new?error=Name+is+required')
  if (!frequency)
    redirect('/owner/checklist/new?error=Pick+a+frequency')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cleaning_tasks')
    .insert({ name, frequency, area, sort_order, active: true })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/checklist/new?error=${encodeURIComponent(error?.message ?? 'Failed to create task')}`,
    )
  }
  revalidatePath('/owner/checklist')
  revalidatePath('/staff/checklist')
  redirect(`/owner/checklist/${data.id}?notice=Task+added`)
}

export async function updateTask(id: string, formData: FormData) {
  await requireOwner()
  const { name, frequency, area, sort_order } = parseTaskPayload(formData)
  if (!name) redirect(`/owner/checklist/${id}?error=Name+is+required`)
  if (!frequency)
    redirect(`/owner/checklist/${id}?error=Pick+a+frequency`)

  const admin = createAdminClient()
  const { error } = await admin
    .from('cleaning_tasks')
    .update({ name, frequency, area, sort_order })
    .eq('id', id)

  if (error) {
    redirect(`/owner/checklist/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/checklist')
  revalidatePath(`/owner/checklist/${id}`)
  revalidatePath('/staff/checklist')
  redirect(`/owner/checklist/${id}?notice=Saved`)
}

async function setTaskActive(id: string, active: boolean) {
  await requireOwner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('cleaning_tasks')
    .update({ active })
    .eq('id', id)
  if (error) {
    redirect(`/owner/checklist/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/checklist')
  revalidatePath(`/owner/checklist/${id}`)
  revalidatePath('/staff/checklist')
  redirect(
    `/owner/checklist/${id}?notice=${active ? 'Reactivated' : 'Deactivated'}`,
  )
}

export async function deactivateTask(id: string) {
  await setTaskActive(id, false)
}
export async function reactivateTask(id: string) {
  await setTaskActive(id, true)
}

/**
 * Staff ticks off a task. Idempotent per day — duplicate insert is caught
 * by the unique index and surfaced as a friendly message.
 */
export async function completeTask(taskId: string) {
  const session = await requireStaffFeature('checklist')
  if (session.role !== 'staff') {
    redirect('/?error=Only+staff+complete+checklist+tasks')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('cleaning_log').insert({
    task_id: taskId,
    user_id: session.profileId,
  })

  if (error) {
    if (error.code === '23505') {
      redirect('/staff/checklist?notice=Already+ticked+off+for+today')
    }
    redirect(`/staff/checklist?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/checklist')
  revalidatePath('/manager/compliance')
  redirect('/staff/checklist?notice=Ticked+off')
}
