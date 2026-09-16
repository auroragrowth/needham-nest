import { NextResponse } from 'next/server'
import { bearerMatches, nestyReadToken } from '@/lib/nesty/access'
import { REPORTS } from '@/lib/nesty/catalogue'

export const dynamic = 'force-dynamic'

/** The catalogue itself, so Nesty can see what it may ask. Same token as the reports. */
export async function GET(request: Request) {
  const token = nestyReadToken()
  if (!token) return NextResponse.json({ error: 'Nesty access is closed.' }, { status: 503 })
  if (!bearerMatches(request.headers.get('authorization'), token)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }
  return NextResponse.json(
    { reports: Object.entries(REPORTS).map(([name, r]) => ({ name, params: r.params, about: r.about })) },
    { headers: { 'cache-control': 'no-store' } },
  )
}
