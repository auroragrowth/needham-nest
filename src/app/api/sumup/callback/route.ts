import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForToken, sumupGet } from '@/lib/sumup/client'
import { getAppUrl } from '@/lib/sumup/config'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return NextResponse.redirect(`${getAppUrl()}/login`)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?error=${encodeURIComponent(error)}`,
    )
  }
  if (!code) {
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?error=No+code+returned`,
    )
  }

  try {
    const token = await exchangeCodeForToken(code)
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null

    // Get merchant code so we can label the connection nicely later.
    let merchantCode: string | null = null
    try {
      const me = (await sumupGet<{ merchant_profile?: { merchant_code?: string } }>('/v0.1/me', {
        id: '',
        merchant_code: null,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        expires_at: expiresAt,
        scope: token.scope ?? null,
      })) as { merchant_profile?: { merchant_code?: string } }
      merchantCode = me?.merchant_profile?.merchant_code ?? null
    } catch {
      // /me might fail if scope didn't include user.profile_readonly — fine
    }

    const admin = createAdminClient()
    // Wipe any existing connection (single-tenant) and store the new one
    await admin.from('sumup_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await admin.from('sumup_connections').insert({
      merchant_code: merchantCode,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      scope: token.scope ?? null,
      connected_by: session.profileId,
    })

    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?notice=Connected+to+SumUp`,
    )
  } catch (e) {
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?error=${encodeURIComponent(
        e instanceof Error ? e.message : 'OAuth exchange failed',
      )}`,
    )
  }
}
