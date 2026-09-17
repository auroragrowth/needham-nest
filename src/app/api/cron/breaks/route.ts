import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { pushoverConfigured } from '@/lib/alerts/long-shifts'
import { alertOverdueBreaks } from '@/lib/alerts/breaks'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pushes an alert to the owner's phone when anyone on shift passes the legal
 * break point without enough break. Vercel Cron calls this every 15 minutes
 * (vercel.json) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so break alerts are closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }
  if (!pushoverConfigured()) {
    return json({ error: 'PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY are not both set, so no alerts can be sent.' }, 503)
  }
  const run = await alertOverdueBreaks()
  return json(run, run.failed.length ? 207 : 200)
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
