import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerMatches, nestyReadToken } from '@/lib/nesty/access'
import { argumentsFor, BadRequest, REPORTS } from '@/lib/nesty/catalogue'
import {
  computeDailyStaffingCost,
  computeStaffingCostRange,
  computeWeeklyStaffMatrix,
} from '@/lib/staffing/cost'

export const dynamic = 'force-dynamic'

/**
 * Read-only reports for Nesty. GET only, NESTY_READ_TOKEN only, and only the
 * named reports in src/lib/nesty/catalogue.ts. Nothing here writes.
 *
 *   GET /api/nesty/rota?from=2026-09-14&to=2026-09-20
 *   GET /api/nesty            lists every report and its parameters
 *
 * The proxy lets /api/nesty through without a login cookie; this token check
 * is the gate instead.
 */
export async function GET(request: Request, { params }: { params: Promise<{ query: string }> }) {
  const token = nestyReadToken()
  if (!token) {
    return json({ error: 'NESTY_READ_TOKEN is not set on this deployment, so Nesty access is closed.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), token)) {
    return json({ error: 'Not allowed' }, 401)
  }

  const { query } = await params
  const report = REPORTS[query]
  if (!report) {
    return json({ error: `No report called "${query}"`, reports: catalogueListing() }, 404)
  }

  try {
    const args = argumentsFor(report.params, new URL(request.url).searchParams)

    if (report.kind === 'staffing') {
      const data =
        report.params === 'date'
          ? await computeDailyStaffingCost((args as { p_date: string }).p_date)
          : report.params === 'week'
            ? await computeWeeklyStaffMatrix((args as { p_from: string }).p_from, (args as { p_to: string }).p_to)
            : await computeStaffingCostRange((args as { p_from: string }).p_from, (args as { p_to: string }).p_to)
      return json({ report: query, args, money: 'pounds', data })
    }

    const { data, error } = await createAdminClient().rpc(report.fn, args)
    if (error) return json({ error: error.message }, 500)
    return json({ report: query, args, money: 'pounds', data })
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message }, 400)
    throw e
  }
}

function catalogueListing() {
  return Object.entries(REPORTS).map(([name, r]) => ({ name, params: r.params, about: r.about }))
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
