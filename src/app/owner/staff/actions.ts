'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { STAFF_FEATURES, type StaffFeature } from '@/lib/permissions'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

async function hashPin(pin: string): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('hash_pin', { p_pin: pin })
  if (error || !data) throw new Error(error?.message ?? 'Failed to hash PIN')
  return String(data)
}

async function pinIsTaken(
  pin: string,
  excludeProfileId?: string,
): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.rpc('verify_pin', { p_pin: pin })
  if (!Array.isArray(data) || data.length === 0) return false
  return data.some(
    (row: { profile_id: string }) => row.profile_id !== excludeProfileId,
  )
}

export async function createStaff(formData: FormData) {
  await requireOwner()
  const name = String(formData.get('name') ?? '').trim()
  const pin = String(formData.get('pin') ?? '').trim()
  const roleRaw = String(formData.get('role') ?? 'staff').trim()
  const role = roleRaw === 'manager' ? 'manager' : 'staff'

  if (!name) {
    redirect('/owner/staff/new?error=Name+is+required')
  }
  if (!/^\d{4}$/.test(pin)) {
    redirect('/owner/staff/new?error=PIN+must+be+exactly+4+digits')
  }
  if (await pinIsTaken(pin)) {
    redirect('/owner/staff/new?error=PIN+already+in+use+%E2%80%94+pick+another')
  }

  const dobStr = String(formData.get('date_of_birth') ?? '').trim()
  const pinHash = await hashPin(pin)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .insert({
      name,
      role,
      pin_hash: pinHash,
      active: true,
      date_of_birth: dobStr || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/staff/new?error=${encodeURIComponent(error?.message ?? 'Failed to create person')}`,
    )
  }

  revalidatePath('/owner/staff')
  redirect(
    `/owner/staff/${data.id}?notice=${role === 'manager' ? 'Manager+added' : 'Staff+added'}`,
  )
}

export async function updateStaffRole(profileId: string, formData: FormData) {
  await requireOwner()
  const roleRaw = String(formData.get('role') ?? '').trim()
  if (roleRaw !== 'staff' && roleRaw !== 'manager') {
    redirect(`/owner/staff/${profileId}?error=Pick+a+valid+role`)
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role: roleRaw })
    .eq('id', profileId)
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Role+updated`)
}

export async function updateStaffName(profileId: string, formData: FormData) {
  await requireOwner()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    redirect(`/owner/staff/${profileId}?error=Name+is+required`)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ name })
    .eq('id', profileId)

  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Name+updated`)
}

export async function updateStaffDetails(
  profileId: string,
  formData: FormData,
) {
  await requireOwner()

  const hourlyStr = String(formData.get('hourly_rate') ?? '').trim()
  const startStr = String(formData.get('start_date') ?? '').trim()
  const contractedStr = String(formData.get('contracted_weekly_hours') ?? '').trim()
  const dobStr = String(formData.get('date_of_birth') ?? '').trim()
  const annualStr = String(formData.get('annual_salary') ?? '').trim()
  const employmentRaw = String(formData.get('employment_type') ?? '').trim()
  const employmentType =
    employmentRaw === 'paye' ||
    employmentRaw === 'casual' ||
    employmentRaw === 'self_employed' ||
    employmentRaw === 'owner_draw'
      ? employmentRaw
      : null

  const payload = {
    phone: String(formData.get('phone') ?? '').trim() || null,
    emergency_contact_name:
      String(formData.get('emergency_contact_name') ?? '').trim() || null,
    emergency_contact_phone:
      String(formData.get('emergency_contact_phone') ?? '').trim() || null,
    right_to_work_ref:
      String(formData.get('right_to_work_ref') ?? '').trim() || null,
    start_date: startStr || null,
    date_of_birth: dobStr || null,
    hourly_rate: hourlyStr === '' ? null : Number(hourlyStr),
    contracted_weekly_hours:
      contractedStr === '' ? null : Number(contractedStr),
    colour_index: (() => {
      const raw = String(formData.get('colour_index') ?? '').trim()
      if (raw === '') return null
      const n = Number(raw)
      return Number.isFinite(n) && n >= 0 && n <= 9 ? n : null
    })(),
    employment_type: employmentType,
    annual_salary: annualStr === '' ? null : Number(annualStr),
    bio: String(formData.get('bio') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    pronouns: String(formData.get('pronouns') ?? '').trim() || null,
    allergies: String(formData.get('allergies') ?? '').trim() || null,
    address_line_1: String(formData.get('address_line_1') ?? '').trim() || null,
    address_line_2: String(formData.get('address_line_2') ?? '').trim() || null,
    address_city: String(formData.get('address_city') ?? '').trim() || null,
    address_postcode:
      String(formData.get('address_postcode') ?? '').trim().toUpperCase() ||
      null,
    ni_number:
      String(formData.get('ni_number') ?? '').trim().toUpperCase() || null,
    bank_sort_code:
      String(formData.get('bank_sort_code') ?? '').trim() || null,
    bank_account_number:
      String(formData.get('bank_account_number') ?? '').trim() || null,
    probation_end_date:
      String(formData.get('probation_end_date') ?? '').trim() || null,
    notice_period_weeks: (() => {
      const raw = String(formData.get('notice_period_weeks') ?? '').trim()
      if (raw === '') return null
      const n = Number(raw)
      return Number.isFinite(n) && n >= 0 ? n : null
    })(),
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(payload)
    .eq('id', profileId)

  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Details+updated`)
}

export async function updateStaffPin(profileId: string, formData: FormData) {
  await requireOwner()
  const pin = String(formData.get('pin') ?? '').trim()

  if (!/^\d{4}$/.test(pin)) {
    redirect(`/owner/staff/${profileId}?error=PIN+must+be+exactly+4+digits`)
  }
  if (await pinIsTaken(pin, profileId)) {
    redirect(
      `/owner/staff/${profileId}?error=PIN+already+in+use+%E2%80%94+pick+another`,
    )
  }

  const pinHash = await hashPin(pin)
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ pin_hash: pinHash })
    .eq('id', profileId)

  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  redirect(`/owner/staff/${profileId}?notice=PIN+updated`)
}

export async function deactivateStaff(profileId: string) {
  await requireOwner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ active: false })
    .eq('id', profileId)
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Staff+deactivated`)
}

export async function reactivateStaff(profileId: string) {
  await requireOwner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ active: true })
    .eq('id', profileId)
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Staff+reactivated`)
}

export async function updateStaffPermissions(
  profileId: string,
  formData: FormData,
) {
  await requireOwner()

  const permissions: Record<StaffFeature, boolean> = {} as Record<
    StaffFeature,
    boolean
  >
  for (const f of STAFF_FEATURES) {
    permissions[f.key] = formData.get(`perm_${f.key}`) === 'on'
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ permissions })
    .eq('id', profileId)

  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath(`/owner/staff/${profileId}`)
  revalidatePath('/staff')
  redirect(`/owner/staff/${profileId}?notice=Permissions+updated`)
}

export async function uploadStaffPhoto(
  profileId: string,
  formData: FormData,
) {
  await requireOwner()
  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/owner/staff/${profileId}?error=Pick+a+photo+to+upload`)
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${profileId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  const admin = createAdminClient()
  const { error: uploadErr } = await admin.storage
    .from('staff-photos')
    .upload(storagePath, bytes, { contentType: file.type })
  if (uploadErr) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(uploadErr.message)}`,
    )
  }
  await admin
    .from('profiles')
    .update({ photo_path: storagePath })
    .eq('id', profileId)
  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Photo+uploaded`)
}

export async function removeStaffPhoto(profileId: string) {
  await requireOwner()
  const admin = createAdminClient()
  const { data: p } = await admin
    .from('profiles')
    .select('photo_path')
    .eq('id', profileId)
    .maybeSingle()
  if (p?.photo_path) {
    await admin.storage.from('staff-photos').remove([p.photo_path])
  }
  await admin
    .from('profiles')
    .update({ photo_path: null })
    .eq('id', profileId)
  revalidatePath('/owner/staff')
  revalidatePath(`/owner/staff/${profileId}`)
  redirect(`/owner/staff/${profileId}?notice=Photo+removed`)
}
