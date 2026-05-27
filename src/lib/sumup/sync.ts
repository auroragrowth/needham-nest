import { createAdminClient } from '@/lib/supabase/admin'
import type { RecipeLine } from '@/lib/menu'
import { getActiveConnection, sumupGet, type SumUpConnection } from './client'

type SumUpTransaction = {
  id: string
  transaction_code?: string
  timestamp: string
  amount: number
  currency: string
  fee_amount?: number
  status: string
  payment_type?: string
  products?: Array<{
    name?: string
    quantity?: number
    price?: number
  }>
}

type SumUpHistoryResponse = {
  items: SumUpTransaction[]
  links?: { next?: string }
}

type SyncResult = {
  ok: boolean
  message: string
  transaction_count: number
  takings_created: number
  stock_movements_created: number
  errors: string[]
}

function startOfDayIso(d: Date): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString()
}

/**
 * Pull SumUp transactions from `since` to now. Creates takings + stock
 * movements (recipe-driven depletion) for each successful transaction
 * that hasn't been imported before. Idempotent via sumup_transactions
 * uniqueness on transaction_id.
 */
export async function syncSumUp(options: {
  since: Date
  importedBy?: string | null
}): Promise<SyncResult> {
  const result: SyncResult = {
    ok: false,
    message: '',
    transaction_count: 0,
    takings_created: 0,
    stock_movements_created: 0,
    errors: [],
  }

  const conn = await getActiveConnection()
  if (!conn) {
    result.message = 'SumUp not connected — connect first.'
    return result
  }

  const admin = createAdminClient()

  // Load menu items (recipes) and stock items for depletion mapping
  const [{ data: menuItems }, { data: stockItems }] = await Promise.all([
    admin
      .from('menu_items')
      .select('id, name, recipe')
      .eq('active', true),
    admin.from('stock_items').select('id, name, unit, cost_price'),
  ])

  // Build a name-keyed index of menu items (lowercase) for matching SumUp
  // product names. SumUp POS sends the product name; we lookup our menu item
  // by case-insensitive name.
  const menuByName = new Map<
    string,
    { id: string; name: string; recipe: RecipeLine[] }
  >()
  for (const m of menuItems ?? []) {
    menuByName.set((m.name ?? '').toLowerCase().trim(), {
      id: m.id,
      name: m.name,
      recipe: (m.recipe ?? []) as RecipeLine[],
    })
  }

  const stockById = new Map(
    (stockItems ?? []).map((s) => [s.id, { name: s.name, cost: Number(s.cost_price ?? 0) }]),
  )

  // Pull transaction history page by page until we hit transactions before `since`
  const sinceIso = startOfDayIso(options.since)
  const transactions: SumUpTransaction[] = []

  try {
    let path: string | null = `/v0.1/me/transactions/history?limit=100&order=desc`
    let pages = 0
    while (path && pages < 20) {
      const page: SumUpHistoryResponse = await sumupGet(path, conn as SumUpConnection)
      const items = page.items ?? []
      let hitBoundary = false
      for (const t of items) {
        if (t.timestamp < sinceIso) {
          hitBoundary = true
          break
        }
        transactions.push(t)
      }
      if (hitBoundary || !page.links?.next) break
      path = page.links.next
      pages += 1
    }
  } catch (e) {
    result.errors.push(
      e instanceof Error ? e.message : 'Failed to fetch transactions',
    )
  }

  result.transaction_count = transactions.length

  // Process each transaction
  const successfulTransactions = transactions.filter(
    (t) => t.status === 'SUCCESSFUL',
  )

  const paymentMix: Record<string, number> = {}
  let totalGross = 0
  let totalFees = 0

  const tradingDates = new Set<string>()

  for (const t of successfulTransactions) {
    const txDate = t.timestamp.slice(0, 10)
    tradingDates.add(txDate)

    paymentMix[t.payment_type ?? 'unknown'] =
      (paymentMix[t.payment_type ?? 'unknown'] ?? 0) + Number(t.amount)
    totalGross += Number(t.amount)
    totalFees += Number(t.fee_amount ?? 0)

    // Dedupe: check if we've already imported this transaction
    const { data: existing } = await admin
      .from('sumup_transactions')
      .select('id')
      .eq('transaction_id', t.id)
      .maybeSingle()
    if (existing) continue

    // Create a takings row for this transaction
    const { data: takings, error: takingsError } = await admin
      .from('takings')
      .insert({
        user_id: options.importedBy ?? null,
        date: txDate,
        source: t.payment_type === 'CASH' ? 'cash' : 'sumup',
        amount: t.amount,
        description: `SumUp ${t.transaction_code ?? t.id}`,
        reference: t.id,
      })
      .select('id')
      .single()

    if (takingsError) {
      result.errors.push(`takings insert: ${takingsError.message}`)
    } else {
      result.takings_created += 1
    }

    // Recipe-driven stock depletion
    const stockMovementInserts: Array<{
      stock_item_id: string
      user_id: string | null
      date: string
      direction: 'out'
      quantity: number
      unit_cost: number | null
      reference: string
      notes: string
    }> = []

    for (const product of t.products ?? []) {
      const productName = (product.name ?? '').toLowerCase().trim()
      if (!productName) continue
      const menuItem = menuByName.get(productName)
      if (!menuItem) continue // not a menu item we know about — skip silently

      const qty = product.quantity ?? 1
      for (const line of menuItem.recipe) {
        const stock = stockById.get(line.stock_item_id)
        if (!stock) continue
        stockMovementInserts.push({
          stock_item_id: line.stock_item_id,
          user_id: options.importedBy ?? null,
          date: txDate,
          direction: 'out',
          quantity: line.quantity * qty,
          unit_cost: stock.cost,
          reference: `sumup:${t.id}`,
          notes: `${menuItem.name} × ${qty}`,
        })
      }
    }

    if (stockMovementInserts.length > 0) {
      const { error: smError } = await admin
        .from('stock_movements')
        .insert(stockMovementInserts)
      if (smError) {
        result.errors.push(`stock movements: ${smError.message}`)
      } else {
        result.stock_movements_created += stockMovementInserts.length
      }
    }

    // Record we've imported this transaction
    await admin.from('sumup_transactions').insert({
      transaction_id: t.id,
      transaction_code: t.transaction_code ?? null,
      occurred_at: t.timestamp,
      amount: t.amount,
      fee: t.fee_amount ?? null,
      net: t.amount - (Number(t.fee_amount ?? 0) || 0),
      payment_type: t.payment_type ?? null,
      status: t.status,
      product_summary: t.products ?? [],
      takings_id: takings?.id ?? null,
      raw: t,
    })
  }

  // Write one till_imports row per trading date covered by this sync
  for (const date of tradingDates) {
    const dayTxs = successfulTransactions.filter(
      (t) => t.timestamp.slice(0, 10) === date,
    )
    const dayGross = dayTxs.reduce((a, t) => a + Number(t.amount), 0)
    const dayFees = dayTxs.reduce((a, t) => a + Number(t.fee_amount ?? 0), 0)
    const dayMix: Record<string, number> = {}
    for (const t of dayTxs) {
      const k = t.payment_type ?? 'unknown'
      dayMix[k] = (dayMix[k] ?? 0) + Number(t.amount)
    }
    await admin.from('till_imports').insert({
      source: 'sumup',
      date,
      gross: dayGross,
      fees: dayFees,
      net: dayGross - dayFees,
      transaction_count: dayTxs.length,
      payment_mix: dayMix,
      imported_by: options.importedBy ?? null,
    })
  }

  // Stamp connection
  await admin
    .from('sumup_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: result.errors.length ? result.errors.join('; ') : null,
    })
    .eq('id', conn.id)

  result.ok = result.errors.length === 0
  result.message = result.ok
    ? `Synced ${result.transaction_count} transactions (${result.takings_created} new), ${result.stock_movements_created} stock movements`
    : `Sync completed with errors: ${result.errors.join('; ')}`
  void totalGross
  void totalFees
  void paymentMix
  return result
}
