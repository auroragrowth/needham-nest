/**
 * UK Working Time Regulations 1998 compliance checks for rota shifts.
 *
 * Adults (18+):
 *  - 20 minute uninterrupted rest break for any shift longer than 6 hours
 *  - 11 consecutive hours daily rest between working days
 *  - 24 consecutive hours weekly rest in every 7-day period (or 48h
 *    fortnightly — we use the stricter weekly read for safety)
 *
 * Young workers (under 18, above compulsory school age):
 *  - 30 minute break for any shift longer than 4.5 hours
 *  - 12 consecutive hours daily rest
 *  - 48 consecutive hours weekly rest in every 7-day period
 */

export type ShiftLite = {
  id: string
  staff_user_id: string
  date: string // YYYY-MM-DD
  start_time: string // HH:MM[:SS]
  end_time: string // HH:MM[:SS]
  break_minutes: number
}

export type ComplianceFlag =
  | { kind: 'no_break'; required_minutes: number; shift_hours: number }
  | { kind: 'short_break'; required_minutes: number; actual_minutes: number }
  | { kind: 'daily_rest'; actual_hours: number; required_hours: number }
  | { kind: 'no_weekly_rest'; required_hours: number }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function isUnderEighteen(
  dateOfBirth: string | null | undefined,
  onDate: string,
): boolean {
  if (!dateOfBirth) return false
  const dob = new Date(dateOfBirth + 'T00:00:00Z')
  const ref = new Date(onDate + 'T00:00:00Z')
  const eighteenth = new Date(
    Date.UTC(
      dob.getUTCFullYear() + 18,
      dob.getUTCMonth(),
      dob.getUTCDate(),
    ),
  )
  return ref < eighteenth
}

export function shiftPaidHours(s: ShiftLite): number {
  const minutes =
    timeToMinutes(s.end_time) - timeToMinutes(s.start_time) - (s.break_minutes ?? 0)
  return Math.max(0, minutes) / 60
}

export function shiftGrossHours(s: ShiftLite): number {
  const minutes = timeToMinutes(s.end_time) - timeToMinutes(s.start_time)
  return Math.max(0, minutes) / 60
}

/**
 * Flags for a single shift (break length only). Daily/weekly rest are
 * checked across the wider set of shifts in checkRest().
 */
export function checkShiftBreak(
  s: ShiftLite,
  young: boolean,
): ComplianceFlag[] {
  const gross = shiftGrossHours(s)
  const threshold = young ? 4.5 : 6
  const required = young ? 30 : 20
  if (gross <= threshold) return []
  if ((s.break_minutes ?? 0) === 0) {
    return [
      {
        kind: 'no_break',
        required_minutes: required,
        shift_hours: Number(gross.toFixed(1)),
      },
    ]
  }
  if (s.break_minutes < required) {
    return [
      {
        kind: 'short_break',
        required_minutes: required,
        actual_minutes: s.break_minutes,
      },
    ]
  }
  return []
}

/** Returns the daily-rest and weekly-rest flags for one shift, given a
 *  staff member's full list of shifts in date order. */
export function checkRest(
  current: ShiftLite,
  allForStaff: ShiftLite[],
  young: boolean,
): ComplianceFlag[] {
  const flags: ComplianceFlag[] = []
  const requiredDaily = young ? 12 : 11
  const requiredWeekly = young ? 48 : 24

  // Daily rest: find the shift that ended most recently before this one
  // starts. End is `date + end_time` (treat as local — they're all UK).
  const startTs = new Date(
    `${current.date}T${current.start_time.slice(0, 5)}:00Z`,
  ).getTime()
  let mostRecentEnd: number | null = null
  for (const o of allForStaff) {
    if (o.id === current.id) continue
    const endTs = new Date(
      `${o.date}T${o.end_time.slice(0, 5)}:00Z`,
    ).getTime()
    if (endTs <= startTs && (mostRecentEnd === null || endTs > mostRecentEnd)) {
      mostRecentEnd = endTs
    }
  }
  if (mostRecentEnd !== null) {
    const restHours = (startTs - mostRecentEnd) / (1000 * 60 * 60)
    if (restHours < requiredDaily) {
      flags.push({
        kind: 'daily_rest',
        actual_hours: Number(restHours.toFixed(1)),
        required_hours: requiredDaily,
      })
    }
  }

  // Weekly rest: look at the 7 days ending with this shift's date. Need
  // a continuous span of `requiredWeekly` hours with no shift.
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const windowEnd = new Date(`${current.date}T23:59:59Z`).getTime()
  const windowStart = windowEnd - sevenDaysMs
  const workedSegments: Array<[number, number]> = []
  for (const o of allForStaff) {
    const s = new Date(`${o.date}T${o.start_time.slice(0, 5)}:00Z`).getTime()
    const e = new Date(`${o.date}T${o.end_time.slice(0, 5)}:00Z`).getTime()
    if (e <= windowStart || s >= windowEnd) continue
    workedSegments.push([Math.max(s, windowStart), Math.min(e, windowEnd)])
  }
  workedSegments.sort((a, b) => a[0] - b[0])
  let cursor = windowStart
  let longestGapMs = 0
  for (const [s, e] of workedSegments) {
    longestGapMs = Math.max(longestGapMs, s - cursor)
    cursor = Math.max(cursor, e)
  }
  longestGapMs = Math.max(longestGapMs, windowEnd - cursor)
  const longestRestHours = longestGapMs / (1000 * 60 * 60)
  if (longestRestHours < requiredWeekly) {
    flags.push({
      kind: 'no_weekly_rest',
      required_hours: requiredWeekly,
    })
  }

  return flags
}

export function describeFlag(f: ComplianceFlag): string {
  switch (f.kind) {
    case 'no_break':
      return `Needs a ${f.required_minutes}-min break (shift is ${f.shift_hours}h)`
    case 'short_break':
      return `Break is ${f.actual_minutes} min — statutory minimum is ${f.required_minutes} min`
    case 'daily_rest':
      return `Only ${f.actual_hours}h rest before this shift — needs ${f.required_hours}h`
    case 'no_weekly_rest':
      return `No ${f.required_hours}h continuous rest in the past 7 days`
  }
}
