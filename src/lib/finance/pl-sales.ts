import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Daily till sales, copied into `pl_sales_daily` so the profit and loss runs on
 * what was actually sold.
 *
 * The till (needham-nest-till.vercel.app) is the record of sales, and the P&L
 * never recalculates them. This reads its `v_pl_sales_daily` feed through the
 * till's read-only endpoint and writes one row per day, order type and payment
 * type. The last seven days are re-read every night rather than just yesterday,
 * because an order voided or refunded days later changes a day that has already
 * been written.
 *
 * Safe to run again for any range: rows are upserted on (day, order_type,
 * payment_type), and a combination that has gone from a day is deleted, so a
 * fully voided payment type can't leave a figure behind.
 *
 * Needs TILL_URL and TILL_READ_TOKEN (the till's HUB_READ_TOKEN).
 */

export type PlSalesRow = {
  day: string
  order_type: string
  payment_type: string
  orders: number
  subtotal: number
  discount: number
  refunded: number
  total: number
}

export type PlSalesSyncResult = {
  from: string
  to: string
  days: number
  rows: number
  written: number
  removed: number
  sales: number
  errors: string[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function londonDay(offset = 0): string {
  const now = new Date()
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const shifted = new Date(`${today}T12:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + offset)
  return shifted.toISOString().slice(0, 10)
}

/** Every day in the range, so a day the till has no sales for is still cleared. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export const rowKey = (row: { day: string; order_type: string; payment_type: string }) =>
  `${row.day}|${row.order_type}|${row.payment_type}`

async function tillSales(from: string, to: string): Promise<PlSalesRow[]> {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  const token = process.env.TILL_READ_TOKEN?.trim()
  if (!base || !token) throw new Error('TILL_URL and TILL_READ_TOKEN must be set to sync P&L sales.')

  const response = await fetch(`${base}/api/hub/report/pl-sales-daily?from=${from}&to=${to}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await response.json().catch(() => null)) as { rows?: PlSalesRow[]; error?: string } | null
  if (!response.ok || !body) throw new Error(`till ${from} to ${to}: ${body?.error ?? response.status}`)
  if (!Array.isArray(body.rows)) throw new Error('The till answered without any rows.')
  return body.rows
}

export async function syncPlSales(from: string, to: string): Promise<PlSalesSyncResult> {
  const result: PlSalesSyncResult = { from, to, days: 0, rows: 0, written: 0, removed: 0, sales: 0, errors: [] }
  if (!DAY.test(from) || !DAY.test(to) || from > to) {
    result.errors.push('from and to must be YYYY-MM-DD, from not after to')
    return result
  }

  const admin = createAdminClient()
  let rows: PlSalesRow[]
  try {
    rows = await tillSales(from, to)
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e))
    return result
  }

  result.days = eachDay(from, to).length
  result.rows = rows.length
  result.sales = Math.round(rows.reduce((sum, r) => sum + Number(r.total), 0) * 100) / 100

  if (rows.length) {
    const { error } = await admin.from('pl_sales_daily').upsert(
      rows.map((r) => ({
        day: r.day,
        order_type: r.order_type,
        payment_type: r.payment_type,
        orders: r.orders,
        subtotal: r.subtotal,
        discount: r.discount,
        refunded: r.refunded,
        total: r.total,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'day,order_type,payment_type' },
    )
    if (error) {
      result.errors.push(`writing sales: ${error.message}`)
      return result
    }
    result.written = rows.length
  }

  // Anything held for these days that the till no longer reports has been voided
  // away. Clear it rather than leave a figure nothing backs up.
  const { data: held, error: readError } = await admin
    .from('pl_sales_daily')
    .select('day, order_type, payment_type')
    .gte('day', from)
    .lte('day', to)
  if (readError) {
    result.errors.push(`checking old rows: ${readError.message}`)
    return result
  }
  const fromTill = new Set(rows.map(rowKey))
  const stale = (held ?? []).filter((r) => !fromTill.has(rowKey(r)))
  for (const row of stale) {
    const { error } = await admin
      .from('pl_sales_daily')
      .delete()
      .eq('day', row.day)
      .eq('order_type', row.order_type)
      .eq('payment_type', row.payment_type)
    if (error) result.errors.push(`${rowKey(row)}: ${error.message}`)
    else result.removed += 1
  }
  return result
}
