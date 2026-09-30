/**
 * Agent 11, invoice capture and costs: the café app's side of the costing
 * actions in the till's `invoice-capture` edge function.
 *
 * The till holds everything (invoice lines, the description map, cost
 * proposals, approved costs). This file only talks to it. Nothing here pays an
 * invoice, changes a menu price or adds a supplier; a cost only becomes real
 * when Paul or Ben approves it.
 *
 * Needs TILL_CAPTURE_KEY, the same key the upload uses. Server side only.
 */

const DEFAULT_URL =
  'https://sirmwnwllnarqdaqpzhy.supabase.co/functions/v1/invoice-capture'

function endpoint(action: string, query = ''): string {
  const base = (process.env.TILL_CAPTURE_URL?.trim() || DEFAULT_URL).replace(/\/+$/, '')
  return `${base}?a=${action}${query}`
}

function key(): string {
  const value = process.env.TILL_CAPTURE_KEY?.trim()
  if (!value) throw new Error('TILL_CAPTURE_KEY is not set, so the till cannot be reached.')
  return value
}

async function call<T>(action: string, init?: { body?: unknown; query?: string }): Promise<T> {
  const response = await fetch(endpoint(action, init?.query), {
    method: init?.body === undefined ? 'GET' : 'POST',
    headers: {
      'x-capture-key': key(),
      ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  })
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok || !data || data.error) {
    throw new Error(String(data?.error ?? `The till answered ${response.status}.`))
  }
  return data
}

/* Reading lines ---------------------------------------------------------- */

export type BacklogInvoice = {
  id: string
  file_name: string | null
  invoice_no: string | null
  invoice_date: string | null
  supplier: string | null
  url: string | null
}

/** Confirmed invoices whose lines nobody has read yet, oldest first. */
export function linesBacklog(n: number) {
  return call<{ invoices: BacklogInvoice[]; remaining: number }>('lines_backlog', { query: `&n=${n}` })
}

export type LineIn = {
  description: string
  pack_raw: string | null
  pack_size_qty: number | null
  pack_size_unit: string | null
  /** Pence per pack. */
  pack_price: number | null
  qty: number | null
  /** Pence. */
  line_total: number | null
  confidence: number | null
}

export type DocumentKind = 'invoice' | 'picking_note' | 'repeat' | 'unreadable'

export function postLines(id: string, kind: DocumentKind, lines: LineIn[], note?: string | null) {
  return call<{ ok?: boolean; skipped?: boolean; lines?: number; matched?: number; to_map?: number; proposed?: number; big_moves?: number }>(
    'lines',
    { body: { id, kind, lines, note: note ?? null } },
  )
}

/* The owner screen ------------------------------------------------------- */

export type CostsSummary = { to_map: number; proposed: number; big_moves: number; backlog: number }

export function costsSummary() {
  return call<CostsSummary>('summary')
}

export type Named = { id: string; name: string; unit: string | null }

export type MapGroup = {
  supplier_id: string | null
  supplier: string | null
  description: string
  count: number
  latest: {
    date: string
    pack_raw: string | null
    pack_size_qty: number | null
    pack_size_unit: string | null
    pack_price: number | null
    invoice_id: string
    invoice_no: string | null
    url: string | null
  }
}

export function mapQueue() {
  return call<{ groups: MapGroup[]; ingredients: Named[]; supplies: Named[]; suppliers: { id: string; name: string }[] }>('queue')
}

export function mapLine(input: {
  supplier_id: string
  description: string
  ingredient_id?: string | null
  supply_id?: string | null
  ignore?: boolean
  pack_size_qty?: number | null
  mapped_by: string
}) {
  return call<{ ok: boolean; lines: number; proposed: number }>('map', { body: input })
}

export type Proposal = {
  id: string
  /** Pence per unit. */
  unit_cost: number
  previous_unit_cost: number | null
  change_pct: number | null
  big_move: boolean
  effective_from: string
  created_at: string
  ingredient: Named | null
  supply: Named | null
  line: {
    description_raw: string
    pack_raw: string | null
    pack_size_qty: number | null
    pack_size_unit: string | null
    pack_price: number | null
    qty: number | null
    invoice: { id: string; invoice_no: string | null; invoice_date: string | null; supplier: { name: string } | null } | null
  } | null
  url: string | null
}

export function costProposals() {
  return call<{ proposals: Proposal[] }>('proposals')
}

export function decideCosts(ids: string[], decision: 'approved' | 'rejected', decidedBy: string) {
  return call<{ ok: boolean; done: number }>('decide', { body: { ids, decision, decided_by: decidedBy } })
}

export function costsActivity() {
  return call<{ activity: { id: string; kind: string; message: string; created_at: string }[] }>('activity')
}

export function staleSuppliers(log: boolean) {
  return call<{ stale: { supplier: string; last_invoice: string | null; days: number | null }[] }>('stale', { body: { log } })
}
