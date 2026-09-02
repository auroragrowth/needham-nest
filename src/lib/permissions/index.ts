import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, type SessionPayload } from '@/lib/auth/session'

export const STAFF_FEATURES = [
  { key: 'clock', label: 'Clock in / out' },
  { key: 'temperatures', label: 'Temperature logs' },
  { key: 'checklist', label: 'Daily checklist' },
  { key: 'stock_count', label: 'Stock count' },
  { key: 'wastage', label: 'Wastage' },
] as const

export type StaffFeature = (typeof STAFF_FEATURES)[number]['key']

export type Permissions = Partial<Record<StaffFeature, boolean>>

/** Owner + manager always have full access. Staff are gated by their permissions blob. */
export function hasPermission(
  role: SessionPayload['role'],
  permissions: Permissions | null | undefined,
  feature: StaffFeature,
): boolean {
  if (role !== 'staff') return true
  if (!permissions) return true
  return permissions[feature] !== false
}

/**
 * Server-side guard for staff pages. Reads the current session, loads the
 * profile's permissions, redirects to /staff if the feature is denied.
 * Returns the session for convenience.
 */
export async function requireStaffFeature(
  feature: StaffFeature,
  returnTo?: string,
): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) {
    // Send them back to where they were headed after they sign in — e.g. a
    // scanned clock QR at /staff/clock?action=…. Only internal paths.
    const safe =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : null
    redirect(safe ? `/login?next=${encodeURIComponent(safe)}` : '/login')
  }

  // Owner / manager bypass entirely
  if (session.role !== 'staff') return session

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('permissions')
    .eq('id', session.profileId)
    .maybeSingle()

  if (!hasPermission(session.role, profile?.permissions ?? null, feature)) {
    redirect(`/staff?error=${encodeURIComponent('You do not have access to that section')}`)
  }

  return session
}
