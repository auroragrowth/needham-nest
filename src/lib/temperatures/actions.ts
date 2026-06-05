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

  const inRange =
    (appliance.target_min == null || temperature >= appliance.target_min) &&
    (appliance.target_max == null || temperature <= appliance.target_max)

  if (!inRange && !correctiveAction) {
    redirect(
      `/staff/temperatures/${applianceId}?error=Out+of+range+%E2%80%94+a+corrective+action+note+is+required.&t=${temperature}`,
    )
  }

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
