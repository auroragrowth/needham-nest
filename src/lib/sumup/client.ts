import { createAdminClient } from '@/lib/supabase/admin'
import {
  SUMUP_BASE,
  SUMUP_TOKEN_URL,
  getClientId,
  getClientSecret,
  getRedirectUri,
} from './config'

export type SumUpConnection = {
  id: string
  merchant_code: string | null
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  scope: string | null
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
  })

  const res = await fetch(SUMUP_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SumUp token exchange failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
  })

  const res = await fetch(SUMUP_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SumUp token refresh failed (${res.status}): ${text}`)
  }
  return res.json()
}

/** Return the active connection, refreshing the access token if it's expired. */
export async function getActiveConnection(): Promise<SumUpConnection | null> {
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('sumup_connections')
    .select('id, merchant_code, access_token, refresh_token, expires_at, scope')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) return null

  // Refresh if expired or about to expire (60s buffer)
  if (conn.expires_at) {
    const expires = new Date(conn.expires_at).getTime()
    if (expires - 60_000 < Date.now() && conn.refresh_token) {
      try {
        const fresh = await refreshAccessToken(conn.refresh_token)
        const newExpires = fresh.expires_in
          ? new Date(Date.now() + fresh.expires_in * 1000).toISOString()
          : null
        await admin
          .from('sumup_connections')
          .update({
            access_token: fresh.access_token,
            refresh_token: fresh.refresh_token ?? conn.refresh_token,
            expires_at: newExpires,
          })
          .eq('id', conn.id)
        return {
          ...conn,
          access_token: fresh.access_token,
          refresh_token: fresh.refresh_token ?? conn.refresh_token,
          expires_at: newExpires,
        }
      } catch (e) {
        // Token refresh failed — surface in last_sync_error so the UI can warn.
        await admin
          .from('sumup_connections')
          .update({
            last_sync_error:
              e instanceof Error ? e.message : 'Token refresh failed',
          })
          .eq('id', conn.id)
        return null
      }
    }
  }

  return conn
}

/** Authenticated GET against the SumUp API. */
export async function sumupGet<T>(
  path: string,
  conn: SumUpConnection,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${SUMUP_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${conn.access_token}`,
      accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SumUp ${path} failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<T>
}
