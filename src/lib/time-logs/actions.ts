'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'

export async function clockIn() {
  const session = await requireStaffFeature('clock')

  const admin = createAdminClient()

  // Pull hourly_rate snapshot (so historical wage calcs are stable even if
  // we change the rate later).
  const { data: profile } = await admin
    .from('profiles')
    .select('hourly_rate')
    .eq('id', session.profileId)
    .maybeSingle()

  const { error } = await admin.from('time_logs').insert({
    user_id: session.profileId,
    hourly_rate: profile?.hourly_rate ?? null,
  })

  if (error) {
    // The partial unique index will catch double-clock-in; surface a tidy
    // message instead of the raw constraint error.
    if (error.code === '23505') {
      redirect('/staff/clock?error=You%20are%20already%20clocked%20in')
    }
    redirect(`/staff/clock?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  revalidatePath('/manager/timesheets')
  redirect('/staff/clock?notice=Clocked+in')
}

export async function clockOut() {
  const session = await requireStaffFeature('clock')

  const admin = createAdminClient()

  const { data: openShift } = await admin
    .from('time_logs')
    .select('id')
    .eq('user_id', session.profileId)
    .is('clock_out', null)
    .maybeSingle()

  if (!openShift) {
    redirect('/staff/clock?error=No%20open%20shift%20to%20clock%20out%20of')
  }

  const { error } = await admin
    .from('time_logs')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', openShift.id)

  if (error) {
    redirect(`/staff/clock?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  revalidatePath('/manager/timesheets')
  redirect('/staff/clock?notice=Clocked+out')
}
