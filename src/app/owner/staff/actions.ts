'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function pinFromForm(formData: FormData): string {
  return String(formData.get('pin') ?? '').trim()
}

export async function createStaff(formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get('name') ?? '').trim()
  const pin = pinFromForm(formData)

  const { data, error } = await supabase.rpc('create_staff', {
    p_name: name,
    p_pin: pin,
  })

  if (error) {
    redirect(`/owner/staff/new?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/staff')
  redirect(`/owner/staff/${data}?notice=Staff+added`)
}

export async function updateStaffName(profileId: string, formData: FormData) {
  const supabase = await createClient()
  const name = String(formData.get('name') ?? '').trim()
  const { error } = await supabase.rpc('update_staff_name', {
    p_profile_id: profileId,
    p_name: name,
  })
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath(`/owner/staff/${profileId}`)
  revalidatePath('/owner/staff')
  redirect(`/owner/staff/${profileId}?notice=Name+updated`)
}

export async function updateStaffPin(profileId: string, formData: FormData) {
  const supabase = await createClient()
  const pin = pinFromForm(formData)
  const { error } = await supabase.rpc('update_staff_pin', {
    p_profile_id: profileId,
    p_pin: pin,
  })
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  redirect(`/owner/staff/${profileId}?notice=PIN+updated`)
}

export async function deactivateStaff(profileId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('deactivate_staff', {
    p_profile_id: profileId,
  })
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath(`/owner/staff/${profileId}`)
  revalidatePath('/owner/staff')
  redirect(`/owner/staff/${profileId}?notice=Staff+deactivated`)
}

export async function reactivateStaff(profileId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reactivate_staff', {
    p_profile_id: profileId,
  })
  if (error) {
    redirect(
      `/owner/staff/${profileId}?error=${encodeURIComponent(error.message)}`,
    )
  }
  revalidatePath(`/owner/staff/${profileId}`)
  revalidatePath('/owner/staff')
  redirect(`/owner/staff/${profileId}?notice=Staff+reactivated`)
}
