export const SUMUP_BASE = 'https://api.sumup.com'
export const SUMUP_AUTH_URL = `${SUMUP_BASE}/authorize`
export const SUMUP_TOKEN_URL = `${SUMUP_BASE}/token`
export const SUMUP_SCOPES = ['transactions.history', 'payouts', 'user.profile_readonly']

export function getClientId(): string {
  const v = process.env.SUMUP_CLIENT_ID
  if (!v) throw new Error('SUMUP_CLIENT_ID is not set')
  return v
}

export function getClientSecret(): string {
  const v = process.env.SUMUP_CLIENT_SECRET
  if (!v) throw new Error('SUMUP_CLIENT_SECRET is not set')
  return v
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://needham-nest.vercel.app'
  )
}

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/sumup/callback`
}
