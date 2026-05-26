'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clearSession, createSession } from './session'

/**
 * Sign in via 4-digit PIN. The everyday login for everyone.
 */
export async function signInWithPin(formData: FormData) {
  const pin = String(formData.get('pin') ?? '').trim()

  if (!/^\d{4}$/.test(pin)) {
    redirect('/login?error=PIN+must+be+4+digits')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('verify_pin', { p_pin: pin })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  const match = Array.isArray(data) ? data[0] : null
  if (!match) {
    redirect('/login?error=PIN+not+recognised')
  }

  await createSession({
    profileId: match.profile_id,
    role: match.role,
    name: match.name,
    authUserId: match.auth_user_id,
  })

  revalidatePath('/', 'layout')
  redirect('/')
}

/**
 * Email + password fallback (owner recovery). On success we ALSO mint a PIN
 * session cookie so the rest of the app uses the unified session helper.
 */
export async function signInWithEmail(formData: FormData) {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })

  if (authError) {
    redirect(`/login/email?error=${encodeURIComponent(authError.message)}`)
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, name, auth_user_id')
    .eq('auth_user_id', authData.user!.id)
    .maybeSingle()

  if (profileError) {
    redirect(
      `/login/email?error=${encodeURIComponent('DB error: ' + profileError.message)}`,
    )
  }
  if (!profile) {
    // The profile lookup ran successfully but returned nothing.
    // 99% of the time this means SUPABASE_SERVICE_ROLE_KEY is wrong or
    // missing on the server — the lookup ran as anon, RLS blocked it.
    redirect(
      '/login/email?error=Profile+lookup+returned+empty.+Likely+SUPABASE_SERVICE_ROLE_KEY+is+wrong+on+the+server.',
    )
  }

  await createSession({
    profileId: profile.id,
    role: profile.role,
    name: profile.name,
    authUserId: profile.auth_user_id,
  })

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  // Open signup is no longer used in v1 — kept as a no-op + redirect.
  // Owner is created by us at deployment; staff are added by owner via
  // /owner/staff. Disable in Supabase Dashboard → Authentication.
  redirect('/login')
  void formData
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  await clearSession()
  revalidatePath('/', 'layout')
  redirect('/login')
}
