import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { alertLongShifts, pushoverConfigured, sendPushover } from '@/lib/alerts/long-shifts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Pushes an alert to the owner's phone for any shift over 10 hours.
 *
 * Vercel Cron calls this every 15 minutes (vercel.json) with `Authorization:
 * Bearer $CRON_SECRET`. Add ?test=1 with the same secret to send a test push
 * without looking at any shifts.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so long-shift alerts are closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }
  if (!pushoverConfigured()) {
    return json({ error: 'PUSHOVER_APP_TOKEN and PUSHOVER_USER_KEY are not both set, so no alerts can be sent.' }, 503)
  }

  if (new URL(request.url).searchParams.get('test') === '1') {
    const sent = await sendPushover('Needham Nest', 'Long-shift alerts are working.')
    return json({ test: true, sent }, sent ? 200 : 502)
  }

  const run = await alertLongShifts()
  return json(run, run.failed.length ? 207 : 200)
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
