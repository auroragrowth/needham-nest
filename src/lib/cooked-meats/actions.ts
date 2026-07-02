'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export async function logCookedMeatCheck(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  const item = String(formData.get('item_name') ?? '').trim()
  const tempRaw = String(formData.get('temperature') ?? '').trim()
  const corrective =
    String(formData.get('corrective_action') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!item) {
    redirect('/staff/cooked-meats?error=Item+name+required')
  }
  const temperature = Number(tempRaw)
  if (!Number.isFinite(temperature)) {
    redirect('/staff/cooked-meats?error=Enter+a+temperature')
  }
  if (temperature < 0 || temperature > 200) {
    redirect(
      '/staff/cooked-meats?error=Temperature+looks+wrong+%E2%80%94+enter+in+%C2%B0C',
    )
  }

  const admin = createAdminClient()
  const { error } = await admin.from('cooked_meat_checks').insert({
    user_id: session.profileId,
    item_name: item,
    temperature,
    corrective_action: corrective,
    notes,
  })
  if (error) {
    redirect(
      `/staff/cooked-meats?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/staff/cooked-meats')
  revalidatePath('/manager/compliance')
  revalidatePath('/owner/cooked-meats')
  redirect(
    `/staff/cooked-meats?notice=Logged+${encodeURIComponent(item)}+at+${temperature}%C2%B0C`,
  )
}
