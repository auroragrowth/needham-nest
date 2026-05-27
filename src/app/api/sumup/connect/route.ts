import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  SUMUP_AUTH_URL,
  SUMUP_SCOPES,
  getClientId,
  getRedirectUri,
} from '@/lib/sumup/config'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return NextResponse.redirect(new URL('/login', getRedirectUri()))
  }

  const url = new URL(SUMUP_AUTH_URL)
  url.searchParams.set('client_id', getClientId())
  url.searchParams.set('redirect_uri', getRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SUMUP_SCOPES.join(' '))
  url.searchParams.set('state', session.profileId)

  return NextResponse.redirect(url)
}
