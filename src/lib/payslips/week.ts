/**
 * ISO week identity and the pay-date rule for a weekly pay period.
 *
 * Weekly periods run Mon–Sun and are paid on the Friday that follows the
 * period end — e.g. week ending Sun 19 Jul 2026 is paid Fri 24 Jul 2026,
 * which is the pattern the existing payslips (2026-W25, 2026-W29) follow.
 */

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parse(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** ISO-8601 week number of a date (1–53). */
export function isoWeekNumber(d: Date): number {
  // Algorithm: shift to Thursday of the same ISO week, then count
  // weeks from the first Thursday of the ISO year.
  const target = utcDay(d)
  const dayNum = (target.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3) // Thursday of ISO week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstThuDow = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThuDow + 3)
  return (
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    )
  )
}

/** ISO year a date belongs to — differs from the calendar year at the turn. */
export function isoWeekYear(d: Date): number {
  const target = utcDay(d)
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  return target.getUTCFullYear()
}

/** Returns the ISO-8601 week identifier for a date (e.g. '2026-W25'). */
export function isoWeekIdentifier(d: Date): string {
  return `${isoWeekYear(d)}-W${String(isoWeekNumber(d)).padStart(2, '0')}`
}

/**
 * Label for a date range: 'Week 31' when it is a single ISO week,
 * 'Weeks 29–31' when it spans several.
 */
export function weekLabel(fromIso: string, toIso: string): string {
  const start = isoWeekNumber(parse(fromIso))
  const end = isoWeekNumber(parse(toIso))
  return start === end ? `Week ${start}` : `Weeks ${start}–${end}`
}

/** The Friday on or after the day following a period end. */
export function payDateFor(periodEndIso: string): string {
  const d = parse(periodEndIso)
  do {
    d.setUTCDate(d.getUTCDate() + 1)
  } while (d.getUTCDay() !== 5) // 5 = Friday
  return isoDate(d)
}
