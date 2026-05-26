'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireManagerOrOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

export async function recordCashCount(formData: FormData) {
  const session = await requireManagerOrOwner()
  const counted = Number(formData.get('counted'))
  const expectedStr = String(formData.get('expected') ?? '').trim()
  const expected = expectedStr === '' ? null : Number(expectedStr)
  const date = String(formData.get('date') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!Number.isFinite(counted) || counted < 0) {
    redirect('/manager/cash/count?error=Enter+a+valid+counted+amount')
  }
  if (expected != null && (!Number.isFinite(expected) || expected < 0)) {
    redirect('/manager/cash/count?error=Expected+must+be+a+number')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('cash_counts').insert({
    user_id: session.profileId,
    counted,
    expected,
    date: date ?? undefined,
    notes,
  })

  if (error) {
    redirect(`/manager/cash/count?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/manager')
  revalidatePath('/manager/cash')
  redirect('/manager/cash?notice=Count+recorded')
}

export async function recordCashMovement(formData: FormData) {
  const session = await requireManagerOrOwner()
  const direction = String(formData.get('direction') ?? '').trim()
  const amount = Number(formData.get('amount'))
  const reason = String(formData.get('reason') ?? '').trim()
  const reference = String(formData.get('reference') ?? '').trim() || null
  const date = String(formData.get('date') ?? '').trim() || null

  if (direction !== 'in' && direction !== 'out') {
    redirect('/manager/cash/movement?error=Pick+a+direction')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect('/manager/cash/movement?error=Amount+must+be+greater+than+0')
  }
  if (!reason) {
    redirect('/manager/cash/movement?error=Reason+is+required')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('cash_movements').insert({
    user_id: session.profileId,
    direction,
    amount,
    reason,
    reference,
    date: date ?? undefined,
  })

  if (error) {
    redirect(`/manager/cash/movement?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/manager')
  revalidatePath('/manager/cash')
  redirect('/manager/cash?notice=Movement+recorded')
}
