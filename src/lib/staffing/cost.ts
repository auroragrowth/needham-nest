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

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const start = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDate(d))
  }
  return out
}

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
    segments: Array<{
      clock_in: string
      clock_out: string | null
      hours: number
    }>
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
    segments: Array<{
      clock_in: string
      clock_out: string | null
      hours: number
    }>
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
      segments: [] as Agg['segments'],
    }
    cur.hours += hours
    cur.weightedRateNumer += hours * rate
    cur.cost += cost
    cur.stillClockedIn = cur.stillClockedIn || stillOpen
    cur.segments.push({
      clock_in: l.clock_in,
      clock_out: l.clock_out,
      hours: Number(hours.toFixed(2)),
    })
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
      segments: agg.segments.sort((a, b) =>
        a.clock_in.localeCompare(b.clock_in),
      ),
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

export type WeeklyStaffMatrix = {
  days: string[]
  staff: Array<{
    id: string
    name: string
    employment_type: string | null
    per_day: number[]
    week_total: number
  }>
  day_totals: number[]
  day_cumulative: number[]
  week_grand: number
}

/** Per-staff per-day cost grid for a week. One SQL query for the range. */
export async function computeWeeklyStaffMatrix(
  weekStart: string,
  weekEnd: string,
): Promise<WeeklyStaffMatrix> {
  const admin = createAdminClient()

  const days = eachDay(weekStart, weekEnd)
  const dayIndex = new Map(days.map((d, i) => [d, i]))

  const [{ data: people }, { data: logs }] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, name, employment_type, annual_salary, hourly_rate',
      )
      .eq('active', true)
      .order('name'),
    admin
      .from('time_logs')
      .select('user_id, clock_in, clock_out, hourly_rate')
      .gte('clock_in', `${weekStart}T00:00:00Z`)
      .lte('clock_in', `${weekEnd}T23:59:59Z`),
  ])

  const now = Date.now()
  const hourlyByStaffDay = new Map<string, number[]>()
  for (const l of logs ?? []) {
    const day = l.clock_in.slice(0, 10)
    const idx = dayIndex.get(day)
    if (idx === undefined) continue
    const startMs = new Date(l.clock_in).getTime()
    const endMs = l.clock_out ? new Date(l.clock_out).getTime() : now
    const hours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60))
    if (hours === 0) continue
    const profile = (people ?? []).find((p) => p.id === l.user_id)
    if (!profile) continue
    const rate =
      l.hourly_rate != null
        ? Number(l.hourly_rate)
        : profile.hourly_rate == null
          ? 0
          : Number(profile.hourly_rate)
    let row = hourlyByStaffDay.get(l.user_id)
    if (!row) {
      row = new Array(days.length).fill(0) as number[]
      hourlyByStaffDay.set(l.user_id, row)
    }
    row[idx] += hours * rate
  }

  const staff: WeeklyStaffMatrix['staff'] = []
  for (const p of people ?? []) {
    if (p.employment_type === 'owner_draw') continue
    let per_day: number[]
    if (p.employment_type === 'paye' && p.annual_salary) {
      const daily = Number(p.annual_salary) / 365
      per_day = new Array(days.length).fill(daily) as number[]
    } else {
      per_day = hourlyByStaffDay.get(p.id) ?? new Array(days.length).fill(0)
    }
    const week_total = per_day.reduce((a, n) => a + n, 0)
    // Include every active non-owner-draw profile, even if zero this
    // week — Paul wants the whole team visible on the matrix so he can
    // see who's not clocking in.
    staff.push({
      id: p.id,
      name: p.name,
      employment_type: p.employment_type ?? null,
      per_day: per_day.map((n) => Number(n.toFixed(2))),
      week_total: Number(week_total.toFixed(2)),
    })
  }

  const day_totals = new Array(days.length).fill(0) as number[]
  for (const s of staff) {
    s.per_day.forEach((v, i) => {
      day_totals[i] += v
    })
  }
  const day_cumulative: number[] = []
  let running = 0
  for (const t of day_totals) {
    running += t
    day_cumulative.push(Number(running.toFixed(2)))
  }
  const week_grand = day_totals.reduce((a, n) => a + n, 0)

  return {
    days,
    staff,
    day_totals: day_totals.map((n) => Number(n.toFixed(2))),
    day_cumulative,
    week_grand: Number(week_grand.toFixed(2)),
  }
}

export type DailyTotal = {
  date: string
  paye: number
  hourly: number
  total: number
  cumulative: number
}

/**
 * Day-by-day totals for a date range, plus a running cumulative.
 * One SQL query for the whole range — works for up to ~365 days easily.
 */
export async function computeStaffingCostRange(
  from: string,
  to: string,
): Promise<DailyTotal[]> {
  const admin = createAdminClient()

  const [{ data: people }, { data: logs }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, employment_type, annual_salary, hourly_rate')
      .eq('active', true),
    admin
      .from('time_logs')
      .select('user_id, clock_in, clock_out, hourly_rate')
      .gte('clock_in', `${from}T00:00:00Z`)
      .lte('clock_in', `${to}T23:59:59Z`),
  ])

  const profileById = new Map<
    string,
    { rate: number | null; type: string | null }
  >()
  let payeDailyBaseline = 0
  for (const p of people ?? []) {
    profileById.set(p.id, {
      rate: p.hourly_rate == null ? null : Number(p.hourly_rate),
      type: p.employment_type ?? null,
    })
    if (p.employment_type === 'paye' && p.annual_salary) {
      payeDailyBaseline += Number(p.annual_salary) / 365
    }
  }

  const dailyHourly = new Map<string, number>()
  const now = Date.now()
  for (const l of logs ?? []) {
    const profile = profileById.get(l.user_id)
    if (!profile) continue
    if (profile.type === 'owner_draw' || profile.type === 'paye') continue
    const startMs = new Date(l.clock_in).getTime()
    const endMs = l.clock_out ? new Date(l.clock_out).getTime() : now
    const hours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60))
    if (hours === 0) continue
    const rate =
      l.hourly_rate != null ? Number(l.hourly_rate) : (profile.rate ?? 0)
    const day = l.clock_in.slice(0, 10)
    dailyHourly.set(day, (dailyHourly.get(day) ?? 0) + hours * rate)
  }

  const out: DailyTotal[] = []
  let cumulative = 0
  for (const day of eachDay(from, to)) {
    const hourly = dailyHourly.get(day) ?? 0
    const total = payeDailyBaseline + hourly
    cumulative += total
    out.push({
      date: day,
      paye: Number(payeDailyBaseline.toFixed(2)),
      hourly: Number(hourly.toFixed(2)),
      total: Number(total.toFixed(2)),
      cumulative: Number(cumulative.toFixed(2)),
    })
  }
  return out
}

export type PayslipShift = {
  date: string
  clock_in: string
  clock_out: string | null
  hours: number
  rate: number
  cost: number
}

export type StaffPayslip = {
  staff_id: string
  staff_name: string
  employment_type: string | null
  from: string
  to: string
  shifts: PayslipShift[]
  total_hours: number
  total_gross: number
  paye_days: number
  paye_total: number
}

/**
 * Per-staff payslip for a date range. Returns every clocked shift,
 * sorted oldest first, with the rate that was effective at clock-in
 * (snapshotted on the row). For PAYE staff also returns the daily
 * salary spread × days in the period.
 */
export async function buildStaffPayslip(
  staffId: string,
  from: string,
  to: string,
): Promise<StaffPayslip | null> {
  const admin = createAdminClient()

  const [{ data: profile }, { data: logs }] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, name, employment_type, annual_salary, hourly_rate',
      )
      .eq('id', staffId)
      .maybeSingle(),
    admin
      .from('time_logs')
      .select('clock_in, clock_out, hourly_rate')
      .eq('user_id', staffId)
      .gte('clock_in', `${from}T00:00:00Z`)
      .lte('clock_in', `${to}T23:59:59Z`)
      .order('clock_in', { ascending: true }),
  ])

  if (!profile) return null

  const now = Date.now()
  let total_hours = 0
  let total_gross = 0
  const shifts: PayslipShift[] = []
  for (const l of logs ?? []) {
    const startMs = new Date(l.clock_in).getTime()
    const endMs = l.clock_out ? new Date(l.clock_out).getTime() : now
    const hours = Math.max(0, (endMs - startMs) / (1000 * 60 * 60))
    if (hours === 0) continue
    const rate =
      l.hourly_rate != null
        ? Number(l.hourly_rate)
        : profile.hourly_rate == null
          ? 0
          : Number(profile.hourly_rate)
    const cost = hours * rate
    total_hours += hours
    total_gross += cost
    shifts.push({
      date: l.clock_in.slice(0, 10),
      clock_in: l.clock_in,
      clock_out: l.clock_out,
      hours: Number(hours.toFixed(2)),
      rate: Number(rate.toFixed(2)),
      cost: Number(cost.toFixed(2)),
    })
  }

  let paye_days = 0
  let paye_total = 0
  if (profile.employment_type === 'paye' && profile.annual_salary) {
    paye_days = eachDay(from, to).length
    paye_total = (Number(profile.annual_salary) / 365) * paye_days
  }

  return {
    staff_id: profile.id,
    staff_name: profile.name,
    employment_type: profile.employment_type ?? null,
    from,
    to,
    shifts,
    total_hours: Number(total_hours.toFixed(2)),
    total_gross: Number(total_gross.toFixed(2)),
    paye_days,
    paye_total: Number(paye_total.toFixed(2)),
  }
}
