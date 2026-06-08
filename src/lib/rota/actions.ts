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

function parseShift(formData: FormData) {
  const breakRaw = String(formData.get('break_minutes') ?? '').trim()
  const break_minutes =
    breakRaw === '' ? 0 : Math.max(0, Math.min(240, Number(breakRaw) || 0))
  return {
    staff_user_id: String(formData.get('staff_user_id') ?? '').trim(),
    date: String(formData.get('date') ?? '').trim(),
    start_time: String(formData.get('start_time') ?? '').trim(),
    end_time: String(formData.get('end_time') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim() || null,
    break_minutes,
  }
}

export async function createShift(formData: FormData) {
  const session = await requireOwnerOrManager()
  const data = parseShift(formData)
  if (!data.staff_user_id || !data.date || !data.start_time || !data.end_time) {
    redirect('/manager/rota/new?error=All+fields+required')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('rota_shifts')
    .insert({ ...data, created_by: session.profileId })

  if (error) {
    redirect(`/manager/rota/new?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/manager/rota')
  revalidatePath('/staff/rota')
  redirect(`/manager/rota?week=${data.date}&notice=Shift+added`)
}

export async function updateShift(id: string, formData: FormData) {
  await requireOwnerOrManager()
  const data = parseShift(formData)
  const admin = createAdminClient()
  const { error } = await admin
    .from('rota_shifts')
    .update(data)
    .eq('id', id)
  if (error) {
    redirect(`/manager/rota/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/manager/rota')
  revalidatePath('/staff/rota')
  redirect(`/manager/rota?week=${data.date}&notice=Shift+saved`)
}

export async function deleteShift(id: string, returnDate: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin.from('rota_shifts').delete().eq('id', id)
  if (error) {
    redirect(`/manager/rota?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/manager/rota')
  revalidatePath('/staff/rota')
  redirect(`/manager/rota?week=${returnDate}&notice=Shift+deleted`)
}

/** Publish all draft shifts in a week range so staff can see them. */
export async function publishWeek(formData: FormData) {
  await requireOwnerOrManager()
  const from = String(formData.get('from') ?? '').trim()
  const to = String(formData.get('to') ?? '').trim()
  if (!from || !to) {
    redirect('/manager/rota?error=Invalid+week')
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('rota_shifts')
    .update({ published: true })
    .gte('date', from)
    .lte('date', to)
    .eq('published', false)
  if (error) {
    redirect(`/manager/rota?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/manager/rota')
  revalidatePath('/staff/rota')
  redirect(`/manager/rota?week=${from}&notice=Week+published`)
}
