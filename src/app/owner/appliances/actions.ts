'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

const VALID_KINDS = [
  'fridge',
  'freezer',
  'hot_hold',
  'cold_display',
  'ambient',
] as const
type ApplianceKind = (typeof VALID_KINDS)[number]

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

function parsePayload(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const kindRaw = String(formData.get('kind') ?? '').trim()
  const kind = (VALID_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as ApplianceKind)
    : null
  const location = String(formData.get('location') ?? '').trim() || null

  const minStr = String(formData.get('target_min') ?? '').trim()
  const maxStr = String(formData.get('target_max') ?? '').trim()
  const target_min = minStr === '' ? null : Number(minStr)
  const target_max = maxStr === '' ? null : Number(maxStr)

  return { name, kind, location, target_min, target_max }
}

export async function createAppliance(formData: FormData) {
  await requireOwner()
  const { name, kind, location, target_min, target_max } = parsePayload(formData)

  if (!name) {
    redirect('/owner/appliances/new?error=Name+is+required')
  }
  if (!kind) {
    redirect('/owner/appliances/new?error=Pick+an+appliance+kind')
  }
  if (target_min != null && !Number.isFinite(target_min)) {
    redirect('/owner/appliances/new?error=Target+min+must+be+a+number')
  }
  if (target_max != null && !Number.isFinite(target_max)) {
    redirect('/owner/appliances/new?error=Target+max+must+be+a+number')
  }
  if (target_min != null && target_max != null && target_min > target_max) {
    redirect('/owner/appliances/new?error=Target+min+must+be+%E2%89%A4+target+max')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('appliances')
    .insert({ name, kind, location, target_min, target_max, active: true })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/appliances/new?error=${encodeURIComponent(error?.message ?? 'Failed to create appliance')}`,
    )
  }

  revalidatePath('/owner/appliances')
  revalidatePath('/staff/temperatures')
  redirect(`/owner/appliances/${data.id}?notice=Appliance+added`)
}

export async function updateAppliance(id: string, formData: FormData) {
  await requireOwner()
  const { name, kind, location, target_min, target_max } = parsePayload(formData)

  if (!name) {
    redirect(`/owner/appliances/${id}?error=Name+is+required`)
  }
  if (!kind) {
    redirect(`/owner/appliances/${id}?error=Pick+an+appliance+kind`)
  }
  if (target_min != null && target_max != null && target_min > target_max) {
    redirect(
      `/owner/appliances/${id}?error=Target+min+must+be+%E2%89%A4+target+max`,
    )
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('appliances')
    .update({ name, kind, location, target_min, target_max })
    .eq('id', id)

  if (error) {
    redirect(`/owner/appliances/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner/appliances')
  revalidatePath(`/owner/appliances/${id}`)
  revalidatePath('/staff/temperatures')
  redirect(`/owner/appliances/${id}?notice=Saved`)
}

export async function setApplianceActive(
  id: string,
  active: boolean,
): Promise<void> {
  await requireOwner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('appliances')
    .update({ active })
    .eq('id', id)
  if (error) {
    redirect(`/owner/appliances/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/appliances')
  revalidatePath(`/owner/appliances/${id}`)
  revalidatePath('/staff/temperatures')
  redirect(
    `/owner/appliances/${id}?notice=${active ? 'Reactivated' : 'Deactivated'}`,
  )
}

export async function deactivateAppliance(id: string) {
  await setApplianceActive(id, false)
}

export async function reactivateAppliance(id: string) {
  await setApplianceActive(id, true)
}
