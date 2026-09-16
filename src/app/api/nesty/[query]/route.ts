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

    if (report.kind === 'labour') {
      const { p_from, p_to } = args as { p_from: string; p_to: string }
      return json({ report: query, args, money: 'pounds', data: await labourPercent(p_from, p_to) })
    }

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

/**
 * Staffing cost (the app's own calculation) against takings for each day. Till
 * card and cash takings arrive through the nightly import, so today's sales are
 * only counted once that has run; the note says so.
 */
async function labourPercent(from: string, to: string) {
  const [costs, { data: takings, error }] = await Promise.all([
    computeStaffingCostRange(from, to),
    createAdminClient().from('takings').select('date, amount').gte('date', from).lte('date', to),
  ])
  if (error) throw new Error(error.message)

  const sales = new Map<string, number>()
  for (const t of takings ?? []) sales.set(t.date, (sales.get(t.date) ?? 0) + Number(t.amount))

  const pct = (cost: number, sold: number) => (sold > 0 ? Math.round((cost / sold) * 1000) / 10 : null)
  const round = (n: number) => Math.round(n * 100) / 100
  const days = costs.map((d) => {
    const sold = round(sales.get(d.date) ?? 0)
    return { date: d.date, takings: sold, staffing_cost: round(d.total), labour_percent: pct(d.total, sold) }
  })
  const totalCost = round(days.reduce((s, d) => s + d.staffing_cost, 0))
  const totalSales = round(days.reduce((s, d) => s + d.takings, 0))
  return {
    days,
    total: { takings: totalSales, staffing_cost: totalCost, labour_percent: pct(totalCost, totalSales) },
    note: 'Takings include till card and cash imported nightly, so today may not be in yet. Days with no takings have no percentage.',
  }
}

function catalogueListing() {
  return Object.entries(REPORTS).map(([name, r]) => ({ name, params: r.params, about: r.about }))
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
