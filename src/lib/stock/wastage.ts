/**
 * Wastage logging rules, shared by the tablet form and the server action.
 *
 * Every waste entry says when it was wasted (UK date and time), which reason
 * category it falls under, and in words why. The time is when the stock was
 * wasted, which can be earlier than when it was logged (created_at).
 */

export const WASTAGE_REASONS = [
  { value: 'out_of_date', label: 'Out of date' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'customer_return', label: 'Customer return' },
  { value: 'spillage', label: 'Spillage' },
  { value: 'mistake', label: 'Mistake' },
  { value: 'other', label: 'Other' },
] as const

export type WastageReason = (typeof WASTAGE_REASONS)[number]['value']

export const REASON_LABEL: Record<string, string> = Object.fromEntries(
  WASTAGE_REASONS.map((r) => [r.value, r.label]),
)

/** How far back waste can be logged. Older than this needs a manager to fix in the data. */
export const MAX_DAYS_BACK = 7

/** UK wall-clock day ('YYYY-MM-DD') and time ('HH:MM') of an instant. */
export function londonParts(d: Date): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** The instant a UK wall-clock time on a UK day happened, through BST and GMT. */
export function londonInstant(day: string, time: string): Date {
  const [y, mo, d] = day.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const shown = londonParts(new Date(guess))
  const [sy, smo, sd] = shown.day.split('-').map(Number)
  const [sh, smi] = shown.time.split(':').map(Number)
  return new Date(guess - (Date.UTC(sy, smo - 1, sd, sh, smi) - guess))
}

/** "17 Sep 14:05", UK time. */
export function formatWastedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type WastageInput = {
  day: unknown
  time: unknown
  reason: unknown
  why: unknown
  quantity: unknown
}

export type WastageEntry = {
  wastedAt: Date
  /** UK day of wastedAt, for the date column the reports group by. */
  day: string
  reason: WastageReason
  why: string
  quantity: number
}

/** Checks a waste form. Returns the entry, or the first problem in plain words. */
export function parseWastage(input: WastageInput, now: Date): { entry: WastageEntry } | { error: string } {
  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Quantity must be more than 0' }

  const day = String(input.day ?? '').trim()
  const time = String(input.time ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Pick the date it was wasted' }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Pick the time it was wasted' }
  const wastedAt = londonInstant(day, time)
  if (Number.isNaN(wastedAt.getTime()) || londonParts(wastedAt).day !== day) {
    return { error: 'That date is not valid' }
  }
  // A minute's grace for the clock ticking over while the form is filled in.
  if (wastedAt.getTime() > now.getTime() + 60_000) return { error: 'The time it was wasted can’t be in the future' }
  if (now.getTime() - wastedAt.getTime() > MAX_DAYS_BACK * 24 * 60 * 60 * 1000) {
    return { error: `Waste older than ${MAX_DAYS_BACK} days can’t be logged here — tell a manager` }
  }

  const reasonRaw = String(input.reason ?? '').trim()
  const reason = WASTAGE_REASONS.find((r) => r.value === reasonRaw)?.value
  if (!reason) return { error: 'Pick a reason' }

  const why = String(input.why ?? '').trim()
  if (why.length < 3) return { error: 'Say why it was wasted' }
  if (why.length > 500) return { error: 'Keep why it was wasted under 500 characters' }

  return { entry: { wastedAt, day, reason, why, quantity } }
}
