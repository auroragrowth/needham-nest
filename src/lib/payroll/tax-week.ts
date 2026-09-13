// UK tax weeks.
// Week 1 starts on the Monday of the week containing 6 April.
// For 2026/27 that is Monday 6 April 2026, which makes
// Mon 7 Sep – Sun 13 Sep 2026 week 23, matching the payslips.

const DAY = 86_400_000

function mondayOf(d: Date): number {
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (new Date(day).getUTCDay() + 6) % 7 // Mon = 0
  return day - dow * DAY
}

/** Tax week number (1-53) for any date. */
export function taxWeek(d: Date): number {
  const asUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const startThisYear = Date.UTC(d.getFullYear(), 3, 6)
  const anchorYear =
    asUtc >= startThisYear ? d.getFullYear() : d.getFullYear() - 1
  const anchorMonday = mondayOf(new Date(Date.UTC(anchorYear, 3, 6)))
  return Math.floor((mondayOf(d) - anchorMonday) / (7 * DAY)) + 1
}

/** e.g. "Week 23 · 7 Sep – 13 Sep 2026" */
export function taxWeekLabel(d: Date): string {
  const monday = new Date(mondayOf(d))
  const sunday = new Date(mondayOf(d) + 6 * DAY)
  const short = (x: Date) =>
    x.toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
    })
  return `Week ${taxWeek(d)} \u00b7 ${short(monday)} \u2013 ${short(sunday)} ${sunday.getUTCFullYear()}`
}
