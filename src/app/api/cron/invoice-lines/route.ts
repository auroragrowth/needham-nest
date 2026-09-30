import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { readLinesBacklog } from '@/lib/invoice-capture/lines'

export const dynamic = 'force-dynamic'
// Each invoice is 10 to 40 seconds to read, and they go one at a time.
export const maxDuration = 300

/**
 * Agent 11: reads the lines off the next few confirmed invoices so they can
 * become costs for Paul or Ben to approve on /owner/costs. See
 * src/lib/invoice-capture/lines.ts.
 *
 * Vercel Cron calls this every 15 minutes (vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so invoice line reading is closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }
  try {
    const summary = await readLinesBacklog(4)
    return json(summary, summary.failed ? 207 : 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502)
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
