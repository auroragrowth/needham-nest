import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { readWaiting } from '@/lib/invoice-capture/read'

export const dynamic = 'force-dynamic'
// Each read is 5–20 seconds and they go one at a time.
export const maxDuration = 300

/**
 * Reads into the books any invoice the till still has waiting: a read that
 * failed, one cut off when a phone closed the page, or one sent from the old
 * standalone page. See src/lib/invoice-capture/read.ts.
 *
 * Vercel Cron calls this every 15 minutes (vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so the invoice catch-up is closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }
  try {
    const summary = await readWaiting()
    return json(summary, summary.failed ? 207 : 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
