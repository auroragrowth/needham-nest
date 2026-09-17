import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { syncTillStock } from '@/lib/till/stock'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Keeps the stock take and the till in step (src/lib/till/stock.ts): till items
 * and names come here, stock take counts go to the till. Vercel Cron calls this
 * every 15 minutes (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so the till stock sync is closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }
  const result = await syncTillStock()
  return json(result, result.errors.length ? 207 : 200)
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
