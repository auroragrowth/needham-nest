import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Redirects to /me/onboarding if the signed-in user hasn't completed
 * the staff onboarding form. Called from each role layout, so it runs
 * on every back-office page.
 *
 * Pages under /me/onboarding sit outside all role layouts, so they're
 * naturally exempt — no path-aware logic needed.
 *
 * (Kept the dob-gate filename for import-site stability — the gate now
 * covers the full onboarding form, not just DOB.)
 */
export async function requireDob(profileId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', profileId)
    .maybeSingle()
  if (!data?.onboarding_completed_at) {
    redirect('/me/onboarding')
  }
}
