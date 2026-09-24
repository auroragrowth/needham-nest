import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Changes Nesty may make, only after the owner clicks Apply on a card in Nesty.
 *
 * Nesty's model can only propose these; the Apply click sends them here with
 * NESTY_WRITE_TOKEN, which the model never holds. Each action mirrors the app's
 * own server action for the same change, checks the record is in the expected
 * state first, and reads it back afterwards to confirm the change took.
 */

type Admin = ReturnType<typeof createAdminClient>
type Params = Record<string, unknown>

export class ActionError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/

function text(params: Params, key: string, { min = 1, max = 500, optional = false } = {}): string | null {
  const value = params[key]
  if ((value === undefined || value === null || value === '') && optional) return null
  if (typeof value !== 'string') throw new ActionError(`${key} is required`)
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) throw new ActionError(`${key} must be ${min}–${max} characters`)
  return trimmed
}

function id(params: Params, key: string): string {
  const value = params[key]
  if (typeof value !== 'string' || !UUID.test(value)) throw new ActionError(`${key} must be an id from a report`)
  return value
}

function day(params: Params, key: string): string {
  const value = params[key]
  if (typeof value !== 'string' || !DAY.test(value)) throw new ActionError(`${key} must be YYYY-MM-DD`)
  return value
}

/** "17 Sep 09:12", UK time, for audit notes. */
function stamp(now = new Date()) {
  return now.toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Action = (admin: Admin, ownerId: string, params: Params) => Promise<string>

export const ACTIONS: Record<string, Action> = {
  /** Mirrors addShoppingItem (src/lib/shopping-list/actions.ts). */
  'shopping-list-add': async (admin, ownerId, params) => {
    const item = text(params, 'item', { max: 120 })!
    const notes = text(params, 'notes', { optional: true, max: 300 })
    const { data, error } = await admin
      .from('shopping_list')
      .insert({ item, notes, added_by: ownerId })
      .select('id, item')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'not added')
    return `Added “${data.item}” to the shopping list.`
  },

  /** Records what was done about a temperature reading, as logTemperature stores it. */
  'temperature-corrective-action': async (admin, _ownerId, params) => {
    const readingId = id(params, 'reading_id')
    const action = text(params, 'action', { min: 3, max: 400 })!
    const { data: reading } = await admin
      .from('temperature_logs')
      .select('id, corrective_action')
      .eq('id', readingId)
      .maybeSingle()
    if (!reading) throw new ActionError('That temperature reading no longer exists.')
    const note = `${action} (recorded by Paul via Nesty, ${stamp()})`
    const corrective = reading.corrective_action ? `${reading.corrective_action}; ${note}` : note
    const { error } = await admin.from('temperature_logs').update({ corrective_action: corrective }).eq('id', readingId)
    if (error) throw new Error(error.message)
    const { data: after } = await admin.from('temperature_logs').select('corrective_action').eq('id', readingId).single()
    if (after?.corrective_action !== corrective) throw new Error('the corrective action did not save')
    return 'Corrective action recorded on the reading.'
  },

  /** Mirrors decideLeave (src/lib/rota/leave-actions.ts), only for pending requests. */
  'leave-decide': async (admin, ownerId, params) => {
    const leaveId = id(params, 'leave_id')
    const decision = params.decision
    if (decision !== 'approved' && decision !== 'declined') throw new ActionError('decision must be approved or declined')
    const note = text(params, 'note', { optional: true, max: 300 })
    const { data: request } = await admin.from('leave_requests').select('id, status').eq('id', leaveId).maybeSingle()
    if (!request) throw new ActionError('That leave request no longer exists.')
    if (request.status !== 'pending') throw new ActionError(`That request was already ${request.status}.`)
    const { error } = await admin
      .from('leave_requests')
      .update({
        status: decision,
        decided_at: new Date().toISOString(),
        decided_by: ownerId,
        decided_notes: note ? `${note} (via Nesty)` : 'Decided via Nesty',
      })
      .eq('id', leaveId)
      .eq('status', 'pending')
    if (error) throw new Error(error.message)
    const { data: after } = await admin.from('leave_requests').select('status').eq('id', leaveId).single()
    if (after?.status !== decision) throw new Error('the decision did not save')
    return `Leave ${decision}.`
  },

  /** Mirrors publishWeek (src/lib/rota/actions.ts). */
  'rota-publish': async (admin, _ownerId, params) => {
    const from = day(params, 'from')
    const to = day(params, 'to')
    const span = (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000
    if (span < 0 || span > 13) throw new ActionError('Publish at most two weeks at a time.')
    const { data, error } = await admin
      .from('rota_shifts')
      .update({ published: true })
      .gte('date', from)
      .lte('date', to)
      .eq('published', false)
      .select('id')
    if (error) throw new Error(error.message)
    const { count } = await admin
      .from('rota_shifts')
      .select('id', { count: 'exact', head: true })
      .gte('date', from)
      .lte('date', to)
      .eq('published', false)
    if (count) throw new Error(`${count} shifts are still unpublished`)
    return `Published ${data?.length ?? 0} shifts for ${from} to ${to}.`
  },

  /** Mirrors manuallyMatchExpense (src/lib/invoices/actions.ts), only for unmatched lines. */
  'bank-match-expense': async (admin, _ownerId, params) => {
    const bankId = id(params, 'bank_transaction_id')
    const expenseId = id(params, 'expense_id')
    const [{ data: line }, { data: expense }] = await Promise.all([
      admin.from('bank_transactions').select('id, matched_expense_id, matched_takings_id').eq('id', bankId).maybeSingle(),
      admin.from('expenses').select('id').eq('id', expenseId).maybeSingle(),
    ])
    if (!line) throw new ActionError('That bank line no longer exists.')
    if (!expense) throw new ActionError('That expense no longer exists.')
    if (line.matched_expense_id || line.matched_takings_id) throw new ActionError('That bank line is already matched.')
    const { error } = await admin
      .from('bank_transactions')
      .update({ matched_expense_id: expenseId, manual_match: true })
      .eq('id', bankId)
      .is('matched_expense_id', null)
    if (error) throw new Error(error.message)
    await admin.from('expenses').update({ reconciled_at: new Date().toISOString() }).eq('id', expenseId)
    const { data: after } = await admin.from('bank_transactions').select('matched_expense_id').eq('id', bankId).single()
    if (after?.matched_expense_id !== expenseId) throw new Error('the match did not save')
    return 'Bank line matched to the expense.'
  },
  /**
   * Sets a forgotten clock-out, from a long-shift card (report long-shifts).
   * An owner correction, like fixing a timesheet by hand, so it does not run the
   * closing-list check in clockOut (src/lib/time-logs/actions.ts). A break still
   * in progress is folded into the total up to the new clock-out, as clockOut does.
   */
  'time-log-clock-out': async (admin, _ownerId, params) => {
    const logId = id(params, 'time_log_id')
    const time = text(params, 'clock_out', { min: 5, max: 5 })!
    if (!HHMM.test(time)) throw new ActionError('clock_out must be HH:MM, UK time')
    const expected = params.expected_clock_out
    if (expected !== null && expected !== undefined && typeof expected !== 'string') {
      throw new ActionError('expected_clock_out must be the clock_out from the report, or null')
    }

    const { data: log } = await admin
      .from('time_logs')
      .select('id, user_id, clock_in, clock_out, break_start_at, break_minutes_total, notes')
      .eq('id', logId)
      .maybeSingle()
    if (!log) throw new ActionError('That shift no longer exists.')
    const current = log.clock_out ? londonStamp(log.clock_out) : null
    if (current !== (expected || null)) {
      throw new ActionError(
        current ? `That shift has changed since the card was made: it now ends ${current}.` : 'That shift has changed since the card was made.',
      )
    }

    const clockIn = new Date(log.clock_in)
    const clockOut = londonInstant(londonParts(clockIn).day, time)
    if (clockOut <= clockIn) throw new ActionError(`${time} is before they clocked in at ${londonParts(clockIn).time}.`)
    if (clockOut.getTime() > Date.now()) throw new ActionError(`${time} hasn't happened yet.`)
    if (clockOut.getTime() - clockIn.getTime() > TEN_HOURS_MS) {
      throw new ActionError(`Clocking out at ${time} would still be over 10 hours. Pick an earlier time, or leave the shift as it is.`)
    }

    let breakMinutes = log.break_minutes_total ?? 0
    if (log.break_start_at && new Date(log.break_start_at) < clockOut) {
      breakMinutes += Math.floor((clockOut.getTime() - new Date(log.break_start_at).getTime()) / 60000)
    }
    const was = current ? `recorded clock-out was ${current}` : 'was still clocked in'
    const note = `Clock-out set to ${time} via Nesty — ${was}. Approved by Paul, ${stamp()}.`
    const notes = log.notes ? `${log.notes}\n${note}` : note

    let update = admin
      .from('time_logs')
      .update({ clock_out: clockOut.toISOString(), break_start_at: null, break_minutes_total: breakMinutes, notes })
      .eq('id', logId)
    update = log.clock_out ? update.eq('clock_out', log.clock_out) : update.is('clock_out', null)
    const { error } = await update
    if (error) throw new Error(error.message)

    const [{ data: after }, { data: person }] = await Promise.all([
      admin.from('time_logs').select('clock_out, break_minutes_total').eq('id', logId).single(),
      admin.from('profiles').select('name').eq('id', log.user_id).maybeSingle(),
    ])
    if (!after?.clock_out || new Date(after.clock_out).getTime() !== clockOut.getTime()) {
      throw new Error('the clock-out did not save')
    }
    const hours = (clockOut.getTime() - clockIn.getTime()) / 3_600_000 - (after.break_minutes_total ?? 0) / 60
    return `${person?.name ?? 'They'} clocked out at ${time} — ${hours.toFixed(2)}h after breaks.`
  },

  /**
   * Clocks someone in, for an owner standing at the till with a member of staff
   * whose phone or the tablet won't play ball. Mirrors clockIn
   * (src/lib/time-logs/actions.ts): one open shift per person, nothing else.
   * The time is UK wall-clock today, never in the future.
   */
  'time-log-clock-in': async (admin, _ownerId, params) => {
    const staffId = id(params, 'staff_id')
    const asked = hhmm(params, 'clock_in')

    const { data: person } = await admin
      .from('profiles')
      .select('id, name, active')
      .eq('id', staffId)
      .maybeSingle()
    if (!person) throw new ActionError('That person is not on the staff list.')
    if (!person.active) throw new ActionError(`${person.name} is not an active member of staff.`)

    const { data: open } = await admin
      .from('time_logs')
      .select('id, clock_in')
      .eq('user_id', staffId)
      .is('clock_out', null)
      .maybeSingle()
    if (open) throw new ActionError(`${person.name} is already clocked in, since ${londonStamp(open.clock_in)}.`)

    const now = new Date()
    const clockIn = asked ? londonInstant(londonParts(now).day, asked) : now
    if (clockIn.getTime() > now.getTime() + 60_000) throw new ActionError(`${asked} hasn't happened yet.`)
    if (now.getTime() - clockIn.getTime() > TWELVE_HOURS_MS) {
      throw new ActionError('That is more than 12 hours ago. Add the shift in the café app instead.')
    }

    const at = londonParts(clockIn).time
    const note = `Clocked in at ${at} via Nesty. Approved by Paul, ${stamp()}.`
    const { data: made, error } = await admin
      .from('time_logs')
      .insert({ user_id: staffId, clock_in: clockIn.toISOString(), notes: note })
      .select('id, clock_in')
      .single()
    if (error || !made) throw new Error(error?.message ?? 'the clock-in did not save')
    return `${person.name} clocked in at ${londonParts(new Date(made.clock_in)).time}.`
  },

  /**
   * Corrects a shift's hours: clock-in, clock-out and break, in any combination.
   * The owner fixing a timesheet, as they would by hand, so it does not run the
   * closing-list check in clockOut (src/lib/time-logs/actions.ts). Only the parts
   * given change. Times are UK wall-clock on the day the shift started, so a
   * shift running past midnight has to be fixed in the app.
   */
  'time-log-set-hours': async (admin, _ownerId, params) => {
    const logId = id(params, 'time_log_id')
    const newIn = hhmm(params, 'clock_in')
    const newOut = hhmm(params, 'clock_out')
    const newBreak = minutes(params, 'break_minutes')
    const reason = text(params, 'reason', { min: 3, max: 300 })!
    if (newIn === null && newOut === null && newBreak === null) {
      throw new ActionError('Give a new clock-in, clock-out or break to change.')
    }

    const { data: log } = await admin
      .from('time_logs')
      .select('id, user_id, clock_in, clock_out, break_start_at, break_minutes_total, notes')
      .eq('id', logId)
      .maybeSingle()
    if (!log) throw new ActionError('That shift no longer exists.')

    const wasIn = londonStamp(log.clock_in)
    const wasOut = log.clock_out ? londonStamp(log.clock_out) : null
    expected(params, 'expected_clock_in', wasIn)
    expected(params, 'expected_clock_out', wasOut)

    const day = londonParts(new Date(log.clock_in)).day
    const clockIn = newIn ? londonInstant(day, newIn) : new Date(log.clock_in)
    const clockOut = newOut ? londonInstant(day, newOut) : log.clock_out ? new Date(log.clock_out) : null
    if (clockIn.getTime() > Date.now()) throw new ActionError(`${newIn} hasn't happened yet.`)
    if (clockOut) {
      if (clockOut <= clockIn) throw new ActionError('The clock-out has to be after the clock-in, on the same day.')
      if (clockOut.getTime() > Date.now()) throw new ActionError(`${newOut} hasn't happened yet.`)
      if (clockOut.getTime() - clockIn.getTime() > FOURTEEN_HOURS_MS) {
        throw new ActionError('That would be a shift of over 14 hours. Change it in the app if it really is.')
      }
    }
    if (log.break_start_at && (newOut || newBreak !== null)) {
      throw new ActionError("They're on a break right now, so the break time isn't final. End the break in the app first.")
    }

    const wasBreak = log.break_minutes_total ?? 0
    const breakMinutes = newBreak ?? wasBreak
    if (clockOut && breakMinutes * 60_000 >= clockOut.getTime() - clockIn.getTime()) {
      throw new ActionError('The break is as long as the shift. Check the times.')
    }

    const changes: string[] = []
    if (newIn && newIn !== wasIn.slice(11)) changes.push(`in ${wasIn.slice(11)} → ${newIn}`)
    if (newOut && newOut !== (wasOut?.slice(11) ?? null)) changes.push(`out ${wasOut ? wasOut.slice(11) : 'none'} → ${newOut}`)
    if (newBreak !== null && newBreak !== wasBreak) changes.push(`break ${wasBreak} → ${newBreak} min`)
    if (changes.length === 0) throw new ActionError('Those are already the hours on that shift.')

    const note = `Hours changed via Nesty: ${changes.join('; ')}. Reason: ${reason} Approved by Paul, ${stamp()}.`
    const notes = log.notes ? `${log.notes}\n${note}` : note

    let update = admin
      .from('time_logs')
      .update({
        clock_in: clockIn.toISOString(),
        clock_out: clockOut ? clockOut.toISOString() : null,
        break_minutes_total: breakMinutes,
        notes,
      })
      .eq('id', logId)
      .eq('clock_in', log.clock_in)
    update = log.clock_out ? update.eq('clock_out', log.clock_out) : update.is('clock_out', null)
    const { error } = await update
    if (error) throw new Error(error.message)

    const [{ data: after }, { data: person }] = await Promise.all([
      admin.from('time_logs').select('clock_in, clock_out, break_minutes_total').eq('id', logId).single(),
      admin.from('profiles').select('name').eq('id', log.user_id).maybeSingle(),
    ])
    if (!after || new Date(after.clock_in).getTime() !== clockIn.getTime()) throw new Error('the hours did not save')
    if ((clockOut === null) !== (after.clock_out === null)) throw new Error('the hours did not save')
    if (clockOut && new Date(after.clock_out!).getTime() !== clockOut.getTime()) throw new Error('the hours did not save')

    const who = person?.name ?? 'They'
    if (!clockOut) return `${who} is still clocked in, now from ${londonParts(clockIn).time}.`
    const hours = (clockOut.getTime() - clockIn.getTime()) / 3_600_000 - (after.break_minutes_total ?? 0) / 60
    return `${who}: ${londonParts(clockIn).time}–${londonParts(clockOut).time}, ${after.break_minutes_total ?? 0} min break — ${hours.toFixed(2)}h after breaks.`
  },
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const TEN_HOURS_MS = 10 * 60 * 60 * 1000
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
const FOURTEEN_HOURS_MS = 14 * 60 * 60 * 1000

/** An optional HH:MM time, UK wall-clock. */
function hhmm(params: Params, key: string): string | null {
  const value = params[key]
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !HHMM.test(value.trim())) throw new ActionError(`${key} must be HH:MM, UK time`)
  return value.trim()
}

/** An optional whole number of minutes. */
function minutes(params: Params, key: string): number | null {
  const value = params[key]
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 600) throw new ActionError(`${key} must be a whole number of minutes, 0 to 600`)
  return n
}

/**
 * Refuses when the record has moved on since the card was made: the card carries
 * what the report showed, and it has to still be true.
 */
function expected(params: Params, key: string, current: string | null) {
  const value = params[key]
  if (value === undefined) return
  if (value !== null && typeof value !== 'string') throw new ActionError(`${key} must be the value from the report, or null`)
  if ((value || null) !== current) {
    throw new ActionError(
      current
        ? `That shift has changed since the card was made: it now shows ${current}.`
        : 'That shift has changed since the card was made.',
    )
  }
}

function londonParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** 'YYYY-MM-DD HH:MM' in UK time, the format the reports use. */
function londonStamp(iso: string): string {
  const { day, time } = londonParts(new Date(iso))
  return `${day} ${time}`
}

/** The instant a UK wall-clock time on a UK day happened, through BST and GMT. */
function londonInstant(day: string, time: string): Date {
  const [y, mo, d] = day.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const shown = londonParts(new Date(guess))
  const [sy, smo, sd] = shown.day.split('-').map(Number)
  const [sh, smi] = shown.time.split(':').map(Number)
  return new Date(guess - (Date.UTC(sy, smo - 1, sd, sh, smi) - guess))
}

export async function ownerProfileId(admin: Admin): Promise<string> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'owner')
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!data) throw new Error('No active owner profile to record the change against.')
  return data.id
}
