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
    .select('id, break_start_at, break_minutes_total')
    .eq('user_id', session.profileId)
    .is('clock_out', null)
    .maybeSingle()

  if (!openShift) {
    redirect('/staff/clock?error=No%20open%20shift%20to%20clock%20out%20of')
  }

  // If they're still on break when clocking out, fold the in-progress
  // break into the total so we don't charge them paid time for it.
  let breakTotal = openShift.break_minutes_total ?? 0
  if (openShift.break_start_at) {
    const ms = Date.now() - new Date(openShift.break_start_at).getTime()
    breakTotal += Math.max(0, Math.floor(ms / 60000))
  }

  const { error } = await admin
    .from('time_logs')
    .update({
      clock_out: new Date().toISOString(),
      break_start_at: null,
      break_minutes_total: breakTotal,
    })
    .eq('id', openShift.id)

  if (error) {
    redirect(`/staff/clock?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  revalidatePath('/manager/timesheets')
  redirect('/staff/clock?notice=Clocked+out')
}

export async function startBreak() {
  const session = await requireStaffFeature('clock')
  const admin = createAdminClient()

  const { data: openShift } = await admin
    .from('time_logs')
    .select('id, break_start_at')
    .eq('user_id', session.profileId)
    .is('clock_out', null)
    .maybeSingle()

  if (!openShift) {
    redirect('/staff/clock?error=Clock+in+before+starting+a+break')
  }
  if (openShift.break_start_at) {
    redirect('/staff/clock?error=Already+on+break')
  }

  const { error } = await admin
    .from('time_logs')
    .update({ break_start_at: new Date().toISOString() })
    .eq('id', openShift.id)
  if (error) {
    redirect(`/staff/clock?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  redirect('/staff/clock?notice=On+break')
}

export async function endBreak() {
  const session = await requireStaffFeature('clock')
  const admin = createAdminClient()

  const { data: openShift } = await admin
    .from('time_logs')
    .select('id, break_start_at, break_minutes_total')
    .eq('user_id', session.profileId)
    .is('clock_out', null)
    .maybeSingle()

  if (!openShift || !openShift.break_start_at) {
    redirect('/staff/clock?error=You+are+not+on+a+break')
  }

  const ms = Date.now() - new Date(openShift.break_start_at).getTime()
  const breakMinutes = Math.max(0, Math.floor(ms / 60000))
  const newTotal = (openShift.break_minutes_total ?? 0) + breakMinutes

  const { error } = await admin
    .from('time_logs')
    .update({
      break_start_at: null,
      break_minutes_total: newTotal,
    })
    .eq('id', openShift.id)
  if (error) {
    redirect(`/staff/clock?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  redirect('/staff/clock?notice=Back+to+work')
}
