/**
 * Daily staffing cost = PAYE baseline (salaried people you pay every day,
 * 365 days a year, whether they worked or not) + variable hourly cost
 * (rota_shifts × hourly_rate, minus unpaid break minutes).
 *
 * Used by the manager dashboard and the staffing cost page.
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
  }>
  total: number
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export async function computeDailyStaffingCost(
  date: string,
): Promise<StaffingCostBreakdown> {
  const admin = createAdminClient()

  const [{ data: people }, { data: shifts }] = await Promise.all([
    admin
      .from('profiles')
      .select(
        'id, name, employment_type, annual_salary, hourly_rate',
      )
      .eq('active', true),
    admin
      .from('rota_shifts')
      .select(
        'staff_user_id, start_time, end_time, break_minutes',
      )
      .eq('date', date),
  ])

  const paye_people: StaffingCostBreakdown['paye_people'] = []
  const hourlyRateById = new Map<string, number>()
  for (const p of people ?? []) {
    if (p.employment_type === 'paye' && p.annual_salary) {
      const daily = Number(p.annual_salary) / 365
      paye_people.push({
        id: p.id,
        name: p.name,
        daily_cost: Number(daily.toFixed(2)),
      })
    }
    if (p.hourly_rate) hourlyRateById.set(p.id, Number(p.hourly_rate))
  }
  const paye_baseline = paye_people.reduce(
    (a, p) => a + p.daily_cost,
    0,
  )

  const hoursById = new Map<string, number>()
  for (const s of shifts ?? []) {
    const mins =
      timeToMinutes(s.end_time) -
      timeToMinutes(s.start_time) -
      (s.break_minutes ?? 0)
    if (mins <= 0) continue
    hoursById.set(
      s.staff_user_id,
      (hoursById.get(s.staff_user_id) ?? 0) + mins / 60,
    )
  }

  const hourly_people: StaffingCostBreakdown['hourly_people'] = []
  const payeIds = new Set(paye_people.map((p) => p.id))
  for (const [id, hours] of hoursById) {
    if (payeIds.has(id)) continue // PAYE cost already counted in baseline
    const rate = hourlyRateById.get(id) ?? 0
    const cost = hours * rate
    const person = (people ?? []).find((p) => p.id === id)
    if (!person) continue
    hourly_people.push({
      id,
      name: person.name,
      hours: Number(hours.toFixed(2)),
      rate,
      cost: Number(cost.toFixed(2)),
    })
  }
  const hourly_variable = hourly_people.reduce((a, p) => a + p.cost, 0)

  return {
    date,
    paye_baseline: Number(paye_baseline.toFixed(2)),
    paye_people,
    hourly_variable: Number(hourly_variable.toFixed(2)),
    hourly_people,
    total: Number((paye_baseline + hourly_variable).toFixed(2)),
  }
}
