/**
 * Daily staffing cost from ACTUAL timesheets, not the planned rota:
 *
 *   PAYE baseline  — sum(annual_salary / 365) for every active PAYE
 *                    person, every day, whether they clocked or not
 *                    (they're salaried).
 *   Hourly actual  — sum(clocked_hours × hourly_rate) from time_logs
 *                    where clock_in falls on the date. Uses the rate
 *                    snapshotted on the time_log row if set, otherwise
 *                    falls back to the profile's current hourly_rate.
 *                    Still-on-shift entries (no clock_out) are valued
 *                    up to "now".
 *
 * Owner-draw people are excluded entirely.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type StaffingCostBreakdown = {
  date: string
  paye_baseline: number
  paye_people: Array<{ id: string; name: string; daily_cost: number }>
  hourly_variable: number
  hourly_people: Array<{
    id: string
    name: string
    hours: number
    rate: number
    cost: number
    still_clocked_in: boolean
  }>
  total: number
}

export async function computeDailyStaffingCost(
  date: string,
): Promise<StaffingCostBreakdown> {
  const admin = createAdminClient()

  // Pull a one-day window of time_logs by clock_in date. Use UTC; the
  // cafe is UK so DST handling needs care, but for a day-grouped query
  // this is good enough — refine if Paul reports mismatches around BST
  // transitions.
  const dayStartIso = `${date}T00:00:00Z`
  const dayEndIso = `${date}T23:59:59Z`

  const [{ data: people }, { data: logs }] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, name, employment_type, annual_salary, hourly_rate',
      )
      .eq('active', true),
    admin
      .from('time_logs')
      .select('user_id, clock_in, clock_out, hourly_rate')
      .gte('clock_in', dayStartIso)
      .lte('clock_in', dayEndIso),
  ])

  const paye_people: StaffingCostBreakdown['paye_people'] = []
  const profileById = new Map<
    string,
    { id: string; name: string; hourly_rate: number | null }
  >()
  const excludedIds = new Set<string>()
  for (const p of people ?? []) {
    profileById.set(p.id, {
      id: p.id,
      name: p.name,
      hourly_rate: p.hourly_rate == null ? null : Number(p.hourly_rate),
    })
    if (p.employment_type === 'owner_draw') {
      excludedIds.add(p.id)
      continue
    }
    if (p.employment_type === 'paye' && p.annual_salary) {
      const daily = Number(p.annual_salary) / 365
      paye_people.push({
        id: p.id,
        name: p.name,
        daily_cost: Number(daily.toFixed(2)),
      })
    }
  }
  const paye_baseline = paye_people.reduce(
    (a, p) => a + p.daily_cost,
    0,
  )

  type Agg = {
    hours: number
    weightedRateNumer: number // sum(hours × rate) so we can show a sensible blended rate
    cost: number
    stillClockedIn: boolean
  }
  const aggById = new Map<string, Agg>()
  const now = Date.now()
  for (const l of logs ?? []) {
    const startMs = new Date(l.clock_in).getTime()
    const stillOpen = !l.clock_out
    const endMs = stillOpen ? now : new Date(l.clock_out).getTime()
    const hours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60))
    if (hours === 0) continue
    const profile = profileById.get(l.user_id)
    const rate =
      l.hourly_rate != null
        ? Number(l.hourly_rate)
        : (profile?.hourly_rate ?? 0)
    const cost = hours * rate
    const cur = aggById.get(l.user_id) ?? {
      hours: 0,
      weightedRateNumer: 0,
      cost: 0,
      stillClockedIn: false,
    }
    cur.hours += hours
    cur.weightedRateNumer += hours * rate
    cur.cost += cost
    cur.stillClockedIn = cur.stillClockedIn || stillOpen
    aggById.set(l.user_id, cur)
  }

  const payeIds = new Set(paye_people.map((p) => p.id))
  const hourly_people: StaffingCostBreakdown['hourly_people'] = []
  for (const [id, agg] of aggById) {
    if (payeIds.has(id) || excludedIds.has(id)) continue
    const profile = profileById.get(id)
    if (!profile) continue
    const blendedRate =
      agg.hours > 0 ? agg.weightedRateNumer / agg.hours : 0
    hourly_people.push({
      id,
      name: profile.name,
      hours: Number(agg.hours.toFixed(2)),
      rate: Number(blendedRate.toFixed(2)),
      cost: Number(agg.cost.toFixed(2)),
      still_clocked_in: agg.stillClockedIn,
    })
  }
  hourly_people.sort((a, b) => a.name.localeCompare(b.name))
  const hourly_variable = hourly_people.reduce(
    (a, p) => a + p.cost,
    0,
  )

  return {
    date,
    paye_baseline: Number(paye_baseline.toFixed(2)),
    paye_people,
    hourly_variable: Number(hourly_variable.toFixed(2)),
    hourly_people,
    total: Number((paye_baseline + hourly_variable).toFixed(2)),
  }
}
