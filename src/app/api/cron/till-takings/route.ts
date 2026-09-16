import { NextResponse } from 'next/server'
import { importTillTakings } from '@/lib/till/takings'
import { bearerMatches } from '@/lib/nesty/access'
import { londonToday } from '@/lib/nesty/catalogue'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** The day the till went live, and the furthest back an import may go. */
const TILL_START = '2026-09-08'

/**
 * Imports till card and cash takings into `takings`.
 *
 * Vercel Cron calls this nightly (vercel.json) with `Authorization: Bearer
 * $CRON_SECRET`. By default it refreshes yesterday and today in UK time; pass
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD with the same secret to backfill.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'CRON_SECRET is not set, so the till import is closed.' }, { status: 503 })
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  }

  const today = londonToday()
  const query = new URL(request.url).searchParams
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const from = query.get('from') ?? yesterday.toISOString().slice(0, 10)
  const to = query.get('to') ?? today

  const day = /^\d{4}-\d{2}-\d{2}$/
  if (!day.test(from) || !day.test(to) || from > to) {
    return NextResponse.json({ error: 'from and to must be YYYY-MM-DD, from not after to' }, { status: 400 })
  }
  const result = await importTillTakings(from < TILL_START ? TILL_START : from, to > today ? today : to)
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200, headers: { 'cache-control': 'no-store' } })
}
