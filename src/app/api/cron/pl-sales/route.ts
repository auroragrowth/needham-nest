import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/nesty/access'
import { londonDay, syncPlSales } from '@/lib/finance/pl-sales'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** The café's first trading day, and the furthest back a sync may go. */
const TRADING_START = '2026-06-15'

/**
 * Copies the till's daily sales into `pl_sales_daily`, which the profit and loss
 * reads. See src/lib/finance/pl-sales.ts.
 *
 * Vercel Cron calls this nightly (vercel.json) with `Authorization: Bearer
 * $CRON_SECRET`. By default it re-reads the last seven days, so a late void or
 * refund is picked up; pass ?from=YYYY-MM-DD&to=YYYY-MM-DD with the same secret
 * to backfill.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return json({ error: 'CRON_SECRET is not set, so the P&L sales sync is closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return json({ error: 'Not allowed' }, 401)
  }

  const query = new URL(request.url).searchParams
  const today = londonDay()
  const from = query.get('from') ?? londonDay(-6)
  const to = query.get('to') ?? today

  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(from) || !day.test(to) || from > to) {
    return json({ error: 'from and to must be YYYY-MM-DD, from not after to' }, 400)
  }
  const result = await syncPlSales(from < TRADING_START ? TRADING_START : from, to > today ? today : to)
  return json(result, result.errors.length ? 207 : 200)
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
