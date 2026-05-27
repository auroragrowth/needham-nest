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

async function requireOwnerOrManager() {
  const session = await requireSession()
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

const VALID_KINDS = ['holiday', 'sick', 'unpaid'] as const

export async function requestLeave(formData: FormData) {
  const session = await requireSession()

  // Manager / owner can request for any staff (staff_user_id picker);
  // staff can only request for themselves.
  const requestedFor =
    String(formData.get('staff_user_id') ?? '').trim() || session.profileId
  const staff_user_id =
    session.role === 'staff' ? session.profileId : requestedFor

  const kindRaw = String(formData.get('kind') ?? '').trim()
  const kind = (VALID_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as 'holiday' | 'sick' | 'unpaid')
    : null
  const start_date = String(formData.get('start_date') ?? '').trim()
  const end_date = String(formData.get('end_date') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!kind) {
    redirect(
      session.role === 'staff'
        ? '/staff/leave/new?error=Pick+a+kind'
        : '/manager/leave?error=Pick+a+kind',
    )
  }
  if (!start_date || !end_date) {
    redirect(
      session.role === 'staff'
        ? '/staff/leave/new?error=Both+dates+required'
        : '/manager/leave?error=Both+dates+required',
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.from('leave_requests').insert({
    staff_user_id,
    kind,
    start_date,
    end_date,
    notes,
  })

  if (error) {
    const target =
      session.role === 'staff' ? '/staff/leave/new' : '/manager/leave'
    redirect(`${target}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff/leave')
  revalidatePath('/manager/leave')
  redirect(
    session.role === 'staff'
      ? '/staff/leave?notice=Request+submitted'
      : '/manager/leave?notice=Request+submitted',
  )
}

export async function decideLeave(
  id: string,
  status: 'approved' | 'declined',
  formData: FormData,
) {
  const session = await requireOwnerOrManager()
  const decided_notes = String(formData.get('decided_notes') ?? '').trim() || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('leave_requests')
    .update({
      status,
      decided_at: new Date().toISOString(),
      decided_by: session.profileId,
      decided_notes,
    })
    .eq('id', id)

  if (error) {
    redirect(`/manager/leave?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/manager/leave')
  revalidatePath('/staff/leave')
  redirect(`/manager/leave?notice=Marked+${status}`)
}

export async function deleteLeave(id: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin.from('leave_requests').delete().eq('id', id)
  if (error) {
    redirect(`/manager/leave?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/manager/leave')
  revalidatePath('/staff/leave')
  redirect('/manager/leave?notice=Removed')
}
