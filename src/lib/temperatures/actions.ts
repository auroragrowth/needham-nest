'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'

export async function logTemperature(applianceId: string, formData: FormData) {
  const session = await requireStaffFeature('temperatures')

  const tempStr = String(formData.get('temperature') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  const correctiveAction =
    String(formData.get('corrective_action') ?? '').trim() || null

  const temperature = Number(tempStr)
  if (!Number.isFinite(temperature)) {
    redirect(
      `/staff/temperatures/${applianceId}?error=Enter+a+number`,
    )
  }
  if (temperature < -40 || temperature > 150) {
    redirect(
      `/staff/temperatures/${applianceId}?error=That+looks+wrong.+Enter+the+temperature+in+%C2%B0C.`,
    )
  }

  const admin = createAdminClient()
  const { data: appliance } = await admin
    .from('appliances')
    .select('id, name, target_min, target_max, active')
    .eq('id', applianceId)
    .maybeSingle()

  if (!appliance || !appliance.active) {
    redirect('/staff/temperatures?error=Appliance+not+found')
  }

  // We used to refuse out-of-range readings without a corrective-action
  // note. Paul wants to record what's actually there — the row is still
  // saved with the snapshotted target range so the EHO pack can show
  // out-of-range readings, and the corrective-action box is still
  // available (and encouraged in the UI when it's outside the band).
  const { error } = await admin.from('temperature_logs').insert({
    appliance_id: applianceId,
    user_id: session.profileId,
    temperature,
    target_min_snapshot: appliance.target_min,
    target_max_snapshot: appliance.target_max,
    notes,
    corrective_action: correctiveAction,
  })

  if (error) {
    redirect(
      `/staff/temperatures/${applianceId}?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/staff')
  revalidatePath('/staff/temperatures')
  revalidatePath('/manager')
  redirect(
    `/staff/temperatures?notice=Logged+${encodeURIComponent(appliance.name)}+at+${temperature}%C2%B0C`,
  )
}
