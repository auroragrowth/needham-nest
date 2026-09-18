import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { syncTillStock } from '@/lib/till/stock'
import { applyTillUsage } from '@/lib/till/usage'
import { pushoverConfigured } from '@/lib/alerts/long-shifts'
import { pushRunOuts } from '@/lib/alerts/stock'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Keeps the stock take and the till in step. Three jobs, in this order:
 *
 * 1. Till items and names come here (src/lib/till/stock.ts), so a new till item
 *    is ready to count before its sales arrive.
 * 2. What the till sold comes off the shelves (src/lib/till/usage.ts):
 *    café first, then kitchen, then storage.
 * 3. Anything that selling ran out is pushed to the owner's phone
 *    (src/lib/alerts/stock.ts), once per run-out.
 *
 * Vercel Cron calls this every 15 minutes (vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so the till stock sync is closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }

  const items = await syncTillStock()
  let usage = null
  const errors = [...items.errors]
  try {
    usage = await applyTillUsage()
  } catch (e) {
    // Nothing was applied: the cursor only moves when a window lands, so the
    // next run picks up these sales as well.
    errors.push(`usage: ${e instanceof Error ? e.message : String(e)}`)
  }
  let runOuts = null
  if (pushoverConfigured()) {
    try {
      runOuts = await pushRunOuts()
      for (const name of runOuts.failed) errors.push(`run-out push failed: ${name}`)
    } catch (e) {
      errors.push(`run-outs: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return json({ items, usage, runOuts, errors }, errors.length ? 207 : 200)
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
