'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export async function saveSettings(formData: FormData) {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')
  if (!session.authUserId) {
    redirect('/login/email?notice=Sign+in+with+email+to+configure+settings')
  }

  const ctRate = Number(formData.get('ct_rate') ?? 19)
  const invoiceNext = Number(formData.get('invoice_next_number') ?? 1)

  const openTime = String(formData.get('trading_open_time') ?? '').trim()
  const closeTime = String(formData.get('trading_close_time') ?? '').trim()

  const payload = {
    user_id: session.authUserId,
    company_name: String(formData.get('company_name') ?? '').trim() || null,
    company_number: String(formData.get('company_number') ?? '').trim() || null,
    company_address: String(formData.get('company_address') ?? '').trim() || null,
    bank_name: String(formData.get('bank_name') ?? '').trim() || null,
    bank_account: String(formData.get('bank_account') ?? '').trim() || null,
    ct_rate: Number.isFinite(ctRate) ? ctRate : 19,
    invoice_prefix:
      String(formData.get('invoice_prefix') ?? '').trim() || 'INV-',
    invoice_next_number: Number.isFinite(invoiceNext) ? invoiceNext : 1,
    trading_open_time: openTime || '08:00',
    trading_close_time: closeTime || '16:00',
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('settings')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    redirect(
      `/owner/onboarding?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/owner')
  redirect('/owner?notice=Settings+saved')
}
