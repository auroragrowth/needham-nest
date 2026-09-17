'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { getClosingStatus, isBlocked } from '@/lib/checklist/closing'
import { breakStatus, formatMinutes, isYoungWorkerToday } from '@/lib/breaks/status'
import { alertMissedBreak } from '@/lib/alerts/breaks'

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
  revalidatePath('/staff/checklist')
  revalidatePath('/manager/timesheets')
  redirect('/staff/clock?notice=Clocked+in')
}

export async function clockOut(formData?: FormData) {
  const session = await requireStaffFeature('clock')

  const admin = createAdminClient()

  // Closing up means finishing the closing list first. Enforced here rather
  // than in the page so a scanned QR can't slip past it either.
  const closing = await getClosingStatus(session.profileId)
  const override = String(formData?.get('override_reason') ?? '').trim()
  if (isBlocked(closing) && !override) {
    redirect(
      `/staff/checklist?error=${encodeURIComponent(
        `Finish the closing list before you sign out — ${closing.outstanding.length} still to do.`,
      )}`,
    )
  }

  const { data: openShift } = await admin
    .from('time_logs')
    .select('id, clock_in, break_start_at, break_minutes_total, notes')
    .eq('user_id', session.profileId)
    .is('clock_out', null)
    .maybeSingle()

  if (!openShift) {
    redirect('/staff/clock?error=No%20open%20shift%20to%20clock%20out%20of')
  }

  const now = new Date()

  // If they're still on break when clocking out, fold the in-progress
  // break into the total so we don't charge them paid time for it.
  let breakTotal = openShift.break_minutes_total ?? 0
  if (openShift.break_start_at) {
    const ms = now.getTime() - new Date(openShift.break_start_at).getTime()
    breakTotal += Math.max(0, Math.floor(ms / 60000))
  }

  // Past the legal break point without enough break recorded: ask, never
  // deduct on their behalf. A break they took but didn't tap is recorded as
  // they tell us; one they didn't get stays paid and goes to Paul. Enforced here,
  // like the closing list, so no route to clocking out skips the question.
  const { data: me } = await admin
    .from('profiles')
    .select('date_of_birth')
    .eq('id', session.profileId)
    .maybeSingle()
  const breaks = breakStatus({
    clockIn: openShift.clock_in,
    clockOut: now,
    breakMinutesTotal: openShift.break_minutes_total,
    breakStartAt: openShift.break_start_at,
    youngWorker: isYoungWorkerToday(me?.date_of_birth, now),
  })
  let breakNote: string | null = null
  let missedBreak: string | null | undefined
  if (breaks.status === 'due') {
    const answer = String(formData?.get('break_answer') ?? '')
    const backToQuestion = (error?: string) =>
      `/staff/clock?action=clock-out&break_check=1${override ? `&override=${encodeURIComponent(override)}` : ''}${
        error ? `&error=${encodeURIComponent(error)}` : ''
      }`
    if (answer === 'taken') {
      const minutes = Number(formData?.get('break_minutes'))
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > breaks.shiftMinutes) {
        redirect(backToQuestion('Enter the break minutes as a whole number.'))
      }
      breakTotal += minutes
      breakNote = `Break of ${minutes} min recorded at clock-out (taken, not tapped at the time).`
    } else if (answer === 'missed') {
      missedBreak = String(formData?.get('break_reason') ?? '').trim().slice(0, 300) || null
      breakNote = `No break taken (${breaks.requiredMinutes} min required after ${formatMinutes(breaks.legalAfterMinutes)}) — told at clock-out.${
        missedBreak ? ` Reason: ${missedBreak}` : ''
      }`
    } else {
      redirect(backToQuestion())
    }
  }

  // An override is a deliberate exception — record it on the timesheet so
  // the manager sees what was left and why.
  const closingNote =
    isBlocked(closing) && override
      ? `Signed out with ${closing.outstanding.length} closing job(s) outstanding (${closing.outstanding
          .map((t) => t.name)
          .join('; ')}). Reason given: ${override}`
      : null
  const notes =
    closingNote || breakNote
      ? [openShift.notes, closingNote, breakNote].filter(Boolean).join('\n')
      : openShift.notes

  const { error } = await admin
    .from('time_logs')
    .update({
      clock_out: now.toISOString(),
      break_start_at: null,
      break_minutes_total: breakTotal,
      notes,
    })
    .eq('id', openShift.id)

  if (error) {
    redirect(`/staff/clock?error=${encodeURIComponent(error.message)}`)
  }

  if (missedBreak !== undefined) {
    await alertMissedBreak(openShift.id, session.name, breaks, missedBreak)
  }

  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  revalidatePath('/staff/checklist')
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
