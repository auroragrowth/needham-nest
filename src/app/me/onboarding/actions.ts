'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

function s(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? '').trim()
  return raw === '' ? null : raw
}

const REQUIRED = [
  'date_of_birth',
  'address_line_1',
  'address_city',
  'address_postcode',
  'emergency_contact_name',
  'emergency_contact_phone',
  'uniform_size',
] as const

export async function completeOnboarding(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Validate required fields server-side too — browser required attr can
  // be bypassed.
  for (const field of REQUIRED) {
    if (!s(formData, field)) {
      redirect(
        `/me/onboarding?error=${encodeURIComponent(`Missing required: ${field.replace(/_/g, ' ')}`)}`,
      )
    }
  }

  const medicalConditions = s(formData, 'medical_conditions')
  const medication = s(formData, 'medication')

  // Confirmations: staff must tick they have no medical conditions /
  // medication if they leave the field blank, so we can tell "didn't
  // bother" apart from "actually none".
  const noMedical = formData.get('no_medical') === 'on'
  const noMedication = formData.get('no_medication') === 'on'
  if (!medicalConditions && !noMedical) {
    redirect(
      '/me/onboarding?error=Tick+%22none%22+or+fill+in+medical+conditions',
    )
  }
  if (!medication && !noMedication) {
    redirect(
      '/me/onboarding?error=Tick+%22none%22+or+fill+in+medication',
    )
  }

  const payload = {
    date_of_birth: s(formData, 'date_of_birth'),
    phone: s(formData, 'phone'),
    email: s(formData, 'email'),
    pronouns: s(formData, 'pronouns'),
    address_line_1: s(formData, 'address_line_1'),
    address_line_2: s(formData, 'address_line_2'),
    address_city: s(formData, 'address_city'),
    address_postcode: s(formData, 'address_postcode')?.toUpperCase() ?? null,
    emergency_contact_name: s(formData, 'emergency_contact_name'),
    emergency_contact_phone: s(formData, 'emergency_contact_phone'),
    medical_conditions: noMedical ? 'None reported' : medicalConditions,
    medication: noMedication ? 'None reported' : medication,
    allergies: s(formData, 'allergies'),
    ni_number: s(formData, 'ni_number')?.toUpperCase() ?? null,
    tax_code: s(formData, 'tax_code')?.toUpperCase() ?? null,
    bank_sort_code: s(formData, 'bank_sort_code'),
    bank_account_number: s(formData, 'bank_account_number'),
    uniform_size: s(formData, 'uniform_size'),
    onboarding_completed_at: new Date().toISOString(),
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update(payload)
    .eq('id', session.profileId)
  if (error) {
    redirect(
      `/me/onboarding?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/', 'layout')
  const home =
    session.role === 'owner'
      ? '/owner'
      : session.role === 'manager'
        ? '/manager'
        : '/staff'
  redirect(home)
}
