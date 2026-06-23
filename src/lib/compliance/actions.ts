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

// ---------- Risk assessments ----------

export async function addRiskAssessment(formData: FormData) {
  await requireOwnerOrManager()
  const title = String(formData.get('title') ?? '').trim()
  const reviewed_at = String(formData.get('reviewed_at') ?? '').trim() || null
  const next_review_at =
    String(formData.get('next_review_at') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!title) {
    redirect('/owner/risk-assessments?error=Title+is+required')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('risk_assessments')
    .insert({ title, reviewed_at, next_review_at, notes })
  if (error) {
    redirect(
      `/owner/risk-assessments?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath('/owner/risk-assessments')
  redirect('/owner/risk-assessments?notice=Assessment+added')
}

export async function deleteRiskAssessment(id: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin
    .from('risk_assessments')
    .delete()
    .eq('id', id)
  if (error) {
    redirect(
      `/owner/risk-assessments?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath('/owner/risk-assessments')
  redirect('/owner/risk-assessments?notice=Removed')
}

// ---------- Accident log ----------

export async function addAccident(formData: FormData) {
  // Anyone signed in can file an accident report — staff fill it in
  // from /staff/accident, owner / manager review them on /owner/accidents.
  const session = await getSession()
  if (!session) redirect('/login')

  const occurredStr = String(formData.get('occurred_at') ?? '').trim()
  const person = String(formData.get('person') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const action_taken = String(formData.get('action_taken') ?? '').trim() || null
  const riddor_reportable = formData.get('riddor_reportable') === 'on'

  const isStaff = session.role === 'staff'
  const returnTo = isStaff ? '/staff/accident' : '/owner/accidents'

  if (!person) {
    redirect(`${returnTo}?error=Person+is+required`)
  }
  if (!description) {
    redirect(`${returnTo}?error=Description+is+required`)
  }

  const admin = createAdminClient()
  const { error } = await admin.from('accident_log').insert({
    user_id: session.profileId,
    occurred_at: occurredStr ? new Date(occurredStr).toISOString() : undefined,
    person,
    description,
    action_taken,
    riddor_reportable,
  })
  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/accidents')
  revalidatePath('/staff/accident')
  redirect(
    isStaff
      ? '/staff/accident?notice=Thanks+%E2%80%94+Paul+has+been+notified.'
      : '/owner/accidents?notice=Logged',
  )
}

export async function deleteAccident(id: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin.from('accident_log').delete().eq('id', id)
  if (error) {
    redirect(`/owner/accidents?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/accidents')
  redirect('/owner/accidents?notice=Removed')
}

// ---------- Pest control visits ----------

export async function addPestControlVisit(formData: FormData) {
  await requireOwnerOrManager()
  const date = String(formData.get('date') ?? '').trim() || undefined
  const company = String(formData.get('company') ?? '').trim() || null
  const inspector = String(formData.get('inspector') ?? '').trim() || null
  const findings = String(formData.get('findings') ?? '').trim() || null
  const actions = String(formData.get('actions') ?? '').trim() || null

  const admin = createAdminClient()
  const { error } = await admin.from('pest_control_visits').insert({
    date,
    company,
    inspector,
    findings,
    actions,
  })
  if (error) {
    redirect(`/owner/pest-control?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/pest-control')
  redirect('/owner/pest-control?notice=Visit+logged')
}

export async function deletePestControlVisit(id: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin
    .from('pest_control_visits')
    .delete()
    .eq('id', id)
  if (error) {
    redirect(`/owner/pest-control?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/pest-control')
  redirect('/owner/pest-control?notice=Removed')
}
