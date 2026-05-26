'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

export async function createDirectorLoan(formData: FormData) {
  const session = await requireOwner()

  const date = String(formData.get('date') ?? '').trim() || undefined
  const direction = String(formData.get('direction') ?? '').trim()
  const amount = Number(formData.get('amount'))
  const description = String(formData.get('description') ?? '').trim() || null
  const reference = String(formData.get('reference') ?? '').trim() || null

  if (direction !== 'in' && direction !== 'out') {
    redirect('/owner/director-loan/new?error=Pick+a+direction')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect('/owner/director-loan/new?error=Amount+must+be+greater+than+0')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('director_loans').insert({
    user_id: session.profileId,
    date,
    direction,
    amount,
    description,
    reference,
  })

  if (error) {
    redirect(
      `/owner/director-loan/new?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/owner/director-loan')
  revalidatePath('/owner')
  redirect('/owner/director-loan?notice=Entry+recorded')
}

export async function createPotAllocation(formData: FormData) {
  const session = await requireOwner()

  const date = String(formData.get('date') ?? '').trim() || undefined
  const amount = Number(formData.get('amount'))
  const note = String(formData.get('note') ?? '').trim() || null

  if (!Number.isFinite(amount) || amount === 0) {
    redirect('/owner/tax-pot?error=Enter+a+non-zero+amount+(use+negative+for+withdrawals)')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('pot_allocations').insert({
    user_id: session.profileId,
    pot: 'tax',
    date,
    amount,
    note,
  })

  if (error) {
    redirect(`/owner/tax-pot?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner/tax-pot')
  revalidatePath('/owner')
  redirect('/owner/tax-pot?notice=Allocation+recorded')
}
