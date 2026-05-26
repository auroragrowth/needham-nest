import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS — only use in server-side code
 * AFTER you have verified the caller is permitted to perform the operation.
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Paste it from the Supabase ' +
        'dashboard → Project Settings → API into .env.local (and Vercel).',
    )
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
