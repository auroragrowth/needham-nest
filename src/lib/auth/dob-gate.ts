import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Redirects to /me/dob if the user hasn't recorded their date of birth.
 * Call from inside each role layout so it runs on every back-office page.
 *
 * Pages under /me/dob are outside all role layouts, so they're naturally
 * exempt — no path-aware logic needed.
 */
export async function requireDob(profileId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('date_of_birth')
    .eq('id', profileId)
    .maybeSingle()
  if (!data?.date_of_birth) {
    redirect('/me/dob')
  }
}
