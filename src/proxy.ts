import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // All paths except static files, image optimizer, favicon, and common image extensions.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
