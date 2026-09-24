/**
 * Everything Nesty can ask the café app, by name.
 *
 * Almost all of it is a read-only SQL function in supabase/nesty_read_functions.sql,
 * executable only by the service role. Staffing cost is the exception: it runs
 * the app's own calculation in src/lib/staffing/cost.ts, so Nesty's figures are
 * the ones on the staffing cost pages.
 */

/** Which query-string parameters a report takes. */
export type ParamKind = 'none' | 'date' | 'range' | 'week' | 'search' | 'include-inactive' | 'include-done' | 'optional-range'

export type Report =
  | { kind: 'sql'; fn: string; params: ParamKind; about: string }
  | { kind: 'staffing'; params: 'date' | 'week' | 'range'; about: string }
  | { kind: 'labour'; params: 'range'; about: string }

export const REPORTS: Record<string, Report> = {
  // Shifts and people
  'clocked-in-now': { kind: 'sql', fn: 'nesty_clocked_in_now', params: 'none', about: 'Who is clocked in right now' },
  timesheets: { kind: 'sql', fn: 'nesty_timesheets', params: 'range', about: 'Shifts and net hours per person' },
  'missing-clock-outs': { kind: 'sql', fn: 'nesty_missing_clock_outs', params: 'none', about: 'Forgotten clock-outs and shifts over 10 hours' },
  'long-shifts': { kind: 'sql', fn: 'nesty_long_shifts', params: 'none', about: 'Shifts over 10 hours in the last 2 days, open or closed, with the rota end and a suggested clock-out' },
  'breaks-due': { kind: 'sql', fn: 'nesty_breaks_due', params: 'none', about: 'People on shift due or overdue a break, and shifts in the last 2 days that ended without the required break' },
  rota: { kind: 'sql', fn: 'nesty_rota', params: 'range', about: 'Rota shifts, published and draft' },
  'rota-drafts': { kind: 'sql', fn: 'nesty_rota_drafts', params: 'range', about: 'Unpublished rota shifts in the range' },
  'rota-plan': { kind: 'sql', fn: 'nesty_rota_plan', params: 'range', about: 'Planned rota hours and cost per day, and how many people are on each hour' },
  leave: { kind: 'sql', fn: 'nesty_leave', params: 'range', about: 'Holiday, sick and unpaid leave overlapping the range' },
  availability: { kind: 'sql', fn: 'nesty_availability', params: 'range', about: 'Staff availability' },
  'staff-list': { kind: 'sql', fn: 'nesty_staff_list', params: 'include-inactive', about: 'The team: roles, start dates, onboarding' },

  // Checklists and food safety
  checklist: { kind: 'sql', fn: 'nesty_checklist_status', params: 'date', about: 'Checklist tasks ticked and not ticked on a day' },
  temperatures: { kind: 'sql', fn: 'nesty_temperature_checks', params: 'range', about: 'Fridge and freezer readings' },
  'temperatures-missed': { kind: 'sql', fn: 'nesty_temperature_missed', params: 'range', about: 'Appliances with no reading on a day' },
  'cooked-meats': { kind: 'sql', fn: 'nesty_cooked_meats', params: 'range', about: 'Cooked meat core temperatures' },
  accidents: { kind: 'sql', fn: 'nesty_accidents', params: 'range', about: 'Accidents logged (no names or injuries)' },

  // Stock
  'stock-levels': { kind: 'sql', fn: 'nesty_stock_levels', params: 'search', about: 'Stock on hand and where it is' },
  'run-outs': { kind: 'sql', fn: 'nesty_run_outs', params: 'none', about: 'Things the till has sold out, or sold more of than the iPad had (open, and closed in the last day)' },
  wastage: { kind: 'sql', fn: 'nesty_wastage', params: 'range', about: 'Wastage logged, by reason and cost' },
  'shopping-list': { kind: 'sql', fn: 'nesty_shopping_list', params: 'include-done', about: 'The shopping list' },

  // Money
  'staffing-cost-day': { kind: 'staffing', params: 'date', about: 'Staffing cost for one day, per person' },
  'staffing-cost-week': { kind: 'staffing', params: 'week', about: 'Staffing cost grid for a Monday–Sunday week' },
  'staffing-cost-range': { kind: 'staffing', params: 'range', about: 'Staffing cost day by day' },
  'labour-percent': { kind: 'labour', params: 'range', about: 'Staffing cost as a share of takings, day by day and overall' },
  takings: { kind: 'sql', fn: 'nesty_takings', params: 'range', about: 'Takings by source (till card and cash are imported nightly)' },
  expenses: { kind: 'sql', fn: 'nesty_expenses', params: 'range', about: 'Expenses by category and entry' },
  'invoices-outstanding': { kind: 'sql', fn: 'nesty_invoices_outstanding', params: 'none', about: 'Unpaid and overdue invoices' },
  pl: { kind: 'sql', fn: 'nesty_pl', params: 'range', about: 'Profit and loss as the P&L page works it out' },
  'pl-summary': { kind: 'sql', fn: 'nesty_pl_summary', params: 'range', about: "The P&L month by month: sales, gross profit, wages, overheads, operating profit and how much is still unclassified (agent 09). Wages are a total; no individual's pay" },
  'pl-review-queue': { kind: 'sql', fn: 'nesty_pl_review_queue', params: 'none', about: 'Bank and cash lines no rule could place, waiting for an owner to categorise them' },
  cash: { kind: 'sql', fn: 'nesty_cash', params: 'range', about: 'Cash counts and movements' },
  tips: { kind: 'sql', fn: 'nesty_tips', params: 'range', about: 'Tip pools and shares' },
  'payroll-runs': { kind: 'sql', fn: 'nesty_payroll_runs', params: 'optional-range', about: 'Payroll run totals' },
  'payslip-totals': { kind: 'sql', fn: 'nesty_payslip_totals', params: 'range', about: 'Gross and net pay per person per period' },
  'wage-payments': { kind: 'sql', fn: 'nesty_wage_payments', params: 'range', about: 'Wages generated and paid' },
  'bank-unreconciled': { kind: 'sql', fn: 'nesty_bank_unreconciled', params: 'range', about: 'Bank lines not matched to an expense or takings' },
  'feedback-summary': { kind: 'sql', fn: 'nesty_feedback_summary', params: 'range', about: 'Staff feedback counts and average ratings (no comments)' },
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Today where the café is, not where the server is. */
export function londonToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Monday and Sunday of the week containing `day`. */
export function weekOf(day: string): { start: string; end: string } {
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
  const start = addDays(day, -weekday)
  return { start, end: addDays(start, 6) }
}

export class BadRequest extends Error {}

function day(value: string | null, name: string, fallback: string): string {
  if (value === null || value === '') return fallback
  if (!DAY.test(value)) throw new BadRequest(`${name} must be YYYY-MM-DD`)
  return value
}

/**
 * The query string turned into function arguments. Ranges default to the last
 * seven days up to today; a range may not run backwards or span more than a year.
 */
export function argumentsFor(params: ParamKind, query: URLSearchParams, today = londonToday()) {
  switch (params) {
    case 'none':
      return {}
    case 'date':
      return { p_date: day(query.get('date'), 'date', today) }
    case 'week': {
      const { start, end } = weekOf(day(query.get('week'), 'week', today))
      return { p_from: start, p_to: end }
    }
    case 'search':
      return { p_search: query.get('q')?.trim() || null }
    case 'include-inactive':
      return { p_include_inactive: query.get('include_inactive') === 'true' }
    case 'include-done':
      return { p_include_done: query.get('include_done') === 'true' }
    case 'optional-range':
      return { p_from: query.get('from') ? day(query.get('from'), 'from', today) : null, p_to: query.get('to') ? day(query.get('to'), 'to', today) : null }
    case 'range': {
      const to = day(query.get('to'), 'to', today)
      const from = day(query.get('from'), 'from', addDays(to, -6))
      if (from > to) throw new BadRequest('from must not be after to')
      if (from < addDays(to, -366)) throw new BadRequest('a range can be at most a year')
      return { p_from: from, p_to: to }
    }
  }
}
