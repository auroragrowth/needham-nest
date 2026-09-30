import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { staleSuppliers } from '@/lib/invoice-capture/costs'

export const dynamic = 'force-dynamic'

/**
 * Agent 11's Monday check: suppliers with no invoice for a fortnight, logged
 * to the costs activity so a missing photo gets chased. Monday 06:45 UTC
 * (vercel.json), `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) return json({ error: 'CRON_SECRET is not set.' }, 503)
  if (!bearerMatches(request.headers.get('authorization'), secret)) return json({ error: 'Not allowed' }, 401)
  try {
    return json(await staleSuppliers(true))
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
