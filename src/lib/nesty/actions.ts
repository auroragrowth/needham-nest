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
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const TEN_HOURS_MS = 10 * 60 * 60 * 1000

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
