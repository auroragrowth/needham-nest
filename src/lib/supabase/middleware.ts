import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth/session'

const PUBLIC_PREFIXES = ['/login', '/auth']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Refresh the Supabase session if one is present (only matters for email-
  // login owners and direct DB operations that rely on auth.uid()). Harmless
  // for PIN-only sessions.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )
  await supabase.auth.getUser()

  // Gate on our PIN session cookie (set by signInWithPin or signInWithEmail).
  const session = await getSessionFromRequest(request)

  const pathname = request.nextUrl.pathname
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}
