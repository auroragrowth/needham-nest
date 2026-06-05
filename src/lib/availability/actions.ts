'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/** Anyone signed in adds availability for themselves; manager/owner can add for any staff. */
export async function addAvailability(formData: FormData) {
  const session = await requireSession()

  // Staff can only add for themselves; owner/manager can pick anyone
  const staffIdFromForm = String(formData.get('staff_user_id') ?? '').trim()
  const staff_user_id =
    session.role === 'staff' ? session.profileId : staffIdFromForm || session.profileId

  const date = String(formData.get('date') ?? '').trim()
  const allDay = formData.get('all_day') === 'on'
  const startRaw = String(formData.get('start_time') ?? '').trim()
  const endRaw = String(formData.get('end_time') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!date) {
    redirect(`/staff/availability?error=Pick+a+date`)
  }

  const start_time = allDay ? null : startRaw || null
  const end_time = allDay ? null : endRaw || null

  if (!allDay) {
    if (!start_time || !end_time) {
      redirect('/staff/availability?error=Enter+a+start+and+end+time')
    }
    if (end_time <= start_time) {
      redirect('/staff/availability?error=End+must+be+after+start')
    }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('staff_availability').insert({
    staff_user_id,
    date,
    start_time,
    end_time,
    notes,
  })

  if (error) {
    const target =
      session.role === 'staff' ? '/staff/availability' : '/manager/rota'
    redirect(`${target}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff/availability')
  revalidatePath('/manager/rota')
  redirect(
    session.role === 'staff'
      ? '/staff/availability?notice=Availability+saved'
      : '/manager/rota?notice=Availability+saved',
  )
}

export async function deleteAvailability(id: string) {
  const session = await requireSession()

  const admin = createAdminClient()
  // Staff can only delete their own — RLS would block anyway, but be explicit
  if (session.role === 'staff') {
    const { data: row } = await admin
      .from('staff_availability')
      .select('staff_user_id')
      .eq('id', id)
      .maybeSingle()
    if (!row || row.staff_user_id !== session.profileId) {
      redirect('/staff/availability?error=Not+allowed')
    }
  }

  const { error } = await admin
    .from('staff_availability')
    .delete()
    .eq('id', id)
  if (error) {
    const target =
      session.role === 'staff' ? '/staff/availability' : '/manager/rota'
    redirect(`${target}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff/availability')
  revalidatePath('/manager/rota')
  redirect(
    session.role === 'staff'
      ? '/staff/availability?notice=Removed'
      : '/manager/rota?notice=Removed',
  )
}
