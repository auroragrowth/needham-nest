import { isUnderEighteen } from '@/lib/rota/compliance'

/**
 * Whether someone on shift is due a break, under the Working Time Regulations
 * rules already used for the rota (src/lib/rota/compliance.ts):
 *
 *   adults      20 minutes for a shift over 6 hours
 *   under-18s   30 minutes for a shift over 4½ hours
 *
 * Staff are reminded from an hour before the legal point. Shift length is clock
 * time since clocking in. Break minutes include one still in progress, as
 * clockOut counts it. The app stores total break minutes, not separate breaks,
 * so two short breaks count towards the required one.
 */

export type BreakState = 'fine' | 'soon' | 'due' | 'taken' | 'on_break'

export type BreakRule = { requiredMinutes: number; legalAfterMinutes: number; remindFromMinutes: number }

export const ADULT_RULE: BreakRule = { requiredMinutes: 20, legalAfterMinutes: 6 * 60, remindFromMinutes: 5 * 60 }
export const YOUNG_RULE: BreakRule = { requiredMinutes: 30, legalAfterMinutes: 4.5 * 60, remindFromMinutes: 3.5 * 60 }

export type BreakStatus = BreakRule & {
  status: BreakState
  shiftMinutes: number
  breakMinutes: number
  youngWorker: boolean
}

export function breakStatus(input: {
  clockIn: string | Date
  /** Pass the clock-out time to judge a shift as it ends; omit for a shift still open. */
  clockOut?: string | Date | null
  now?: Date
  breakMinutesTotal: number | null
  breakStartAt: string | Date | null
  youngWorker: boolean
}): BreakStatus {
  const end = input.clockOut ? new Date(input.clockOut) : (input.now ?? new Date())
  const start = new Date(input.clockIn)
  const shiftMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
  let breakMinutes = input.breakMinutesTotal ?? 0
  if (input.breakStartAt) {
    breakMinutes += Math.max(0, Math.floor((end.getTime() - new Date(input.breakStartAt).getTime()) / 60000))
  }
  const rule = input.youngWorker ? YOUNG_RULE : ADULT_RULE

  let status: BreakState
  if (input.breakStartAt && !input.clockOut) status = 'on_break'
  else if (breakMinutes >= rule.requiredMinutes) status = 'taken'
  else if (shiftMinutes > rule.legalAfterMinutes) status = 'due'
  else if (shiftMinutes >= rule.remindFromMinutes) status = 'soon'
  else status = 'fine'

  return { ...rule, status, shiftMinutes, breakMinutes, youngWorker: input.youngWorker }
}

/** Under 18 today, UK date. No date of birth on file counts as an adult, as on the rota. */
export function isYoungWorkerToday(dateOfBirth: string | null | undefined, now = new Date()): boolean {
  return isUnderEighteen(dateOfBirth, now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }))
}

/** 312 → "5h 12m", 360 → "6h", 270 → "4h 30m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`
}
