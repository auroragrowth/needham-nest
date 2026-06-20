import { redirect } from 'next/navigation'

// /me/dob has been replaced by the full /me/onboarding flow.
// Anyone hitting this URL (old bookmarks, gate fallback) lands on
// the new form instead.
export default function LegacyDobRedirect(): never {
  redirect('/me/onboarding')
}
