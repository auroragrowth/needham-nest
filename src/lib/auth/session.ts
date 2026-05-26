import { cookies } from 'next/headers'
import { jwtVerify, SignJWT } from 'jose'
import type { NextRequest } from 'next/server'

export type Role = 'owner' | 'manager' | 'staff'

export type SessionPayload = {
  profileId: string
  role: Role
  name: string
  authUserId: string | null
}

const COOKIE_NAME = 'nn_session'

const SESSION_TTL_SECONDS: Record<Role, number> = {
  owner: 12 * 60 * 60,
  manager: 12 * 60 * 60,
  staff: 30 * 60,
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }
  return new TextEncoder().encode(secret)
}

async function signToken(payload: SessionPayload, ttlSeconds: number): Promise<string> {
  return await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret())
}

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    })
    if (
      typeof payload.profileId === 'string' &&
      typeof payload.name === 'string' &&
      (payload.role === 'owner' ||
        payload.role === 'manager' ||
        payload.role === 'staff')
    ) {
      return {
        profileId: payload.profileId,
        role: payload.role,
        name: payload.name,
        authUserId:
          typeof payload.authUserId === 'string' ? payload.authUserId : null,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Read + verify session from the request — used by the proxy/middleware. */
export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return await verifyToken(token)
}

/** Read + verify session — used by Server Components, Server Actions, Route Handlers. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return await verifyToken(token)
}

/** Mint a session cookie. Expiry depends on role. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const ttl = SESSION_TTL_SECONDS[payload.role]
  const token = await signToken(payload, ttl)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ttl,
  })
}

/** Clear the session cookie. */
export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
