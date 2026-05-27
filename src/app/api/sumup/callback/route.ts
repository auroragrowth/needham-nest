import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCodeForToken, sumupGet } from '@/lib/sumup/client'
import { getAppUrl } from '@/lib/sumup/config'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    console.error('sumup callback: no owner session')
    return NextResponse.redirect(
      `${getAppUrl()}/login?error=${encodeURIComponent('Sign in then try Connect SumUp again')}`,
    )
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.error('sumup callback: SumUp returned error', error, errorDescription)
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?error=${encodeURIComponent(
        `SumUp: ${error}${errorDescription ? ' — ' + errorDescription : ''}`,
      )}`,
    )
  }
  if (!code) {
    console.error('sumup callback: no code in query', request.url)
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?error=No+code+returned`,
    )
  }

  try {
    const token = await exchangeCodeForToken(code)
    console.log('sumup callback: token received', {
      has_access: !!token.access_token,
      has_refresh: !!token.refresh_token,
      expires_in: token.expires_in,
      scope: token.scope,
    })
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null

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
    } catch (e) {
      console.warn('sumup callback: /me failed (non-fatal)', e)
    }

    const admin = createAdminClient()
    const { error: delErr } = await admin
      .from('sumup_connections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (delErr) {
      console.error('sumup callback: delete failed', delErr)
      return NextResponse.redirect(
        `${getAppUrl()}/owner/integrations/sumup?error=${encodeURIComponent('Delete failed: ' + delErr.message)}`,
      )
    }

    const { error: insErr } = await admin.from('sumup_connections').insert({
      merchant_code: merchantCode,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      scope: token.scope ?? null,
      connected_by: session.profileId,
    })
    if (insErr) {
      console.error('sumup callback: insert failed', insErr)
      return NextResponse.redirect(
        `${getAppUrl()}/owner/integrations/sumup?error=${encodeURIComponent('Insert failed: ' + insErr.message)}`,
      )
    }

    console.log('sumup callback: stored connection', { merchantCode })
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?notice=Connected+to+SumUp`,
    )
  } catch (e) {
    console.error('sumup callback: token exchange threw', e)
    return NextResponse.redirect(
      `${getAppUrl()}/owner/integrations/sumup?error=${encodeURIComponent(
        e instanceof Error ? e.message : 'OAuth exchange failed',
      )}`,
    )
  }
}
