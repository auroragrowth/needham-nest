import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The till and the stock take, kept in step. The till is the source of truth for
 * the items it sells.
 *
 * 1. Items. Every item the till counts stock for has a stock_item here, linked by
 *    till_item_id, with the till's name and category. A new till item appears
 *    here ready to count; a renamed one is renamed here.
 * 2. Counts. When a linked item is counted in a stock take (an 'adjust' move),
 *    its total across every location is sent to the till with the time of the
 *    count. The till takes off what it has sold since, so a late send is still
 *    right. till_count_sent_at records the count that was last sent; clearing it
 *    (as changing servings per unit does) sends the latest count again.
 *    An item counted in bigger units than the till sells (a bag-in-box of
 *    post-mix sold as servings) is sent as whole servings: total ×
 *    till_servings_per_unit.
 *
 * The sync only ever changes name, category and active on a linked item, never
 * its unit.
 *
 * Needs TILL_URL, TILL_READ_TOKEN (the till's HUB_READ_TOKEN) and
 * TILL_STOCK_TOKEN (the till's CAFE_STOCK_TOKEN, which can only send counts).
 */

type TillStockRow = { item_id: string; name: string; category: string | null }

type SentCount = { item_id: string; ok: boolean; name?: string; previous?: number; now?: number; sold_since?: number; detail?: string }

export type TillStockResult = {
  itemsCreated: string[]
  itemsRenamed: string[]
  countsSent: SentCount[]
  errors: string[]
}

function tillBase(): string {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  if (!base) throw new Error('TILL_URL is not set.')
  return base
}

async function tillItems(): Promise<TillStockRow[]> {
  const token = process.env.TILL_READ_TOKEN?.trim()
  if (!token) throw new Error('TILL_READ_TOKEN is not set, so the till items cannot be read.')
  const response = await fetch(`${tillBase()}/api/hub/report/stock`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await response.json().catch(() => null)) as { rows?: TillStockRow[]; error?: string } | null
  if (!response.ok || !body?.rows) throw new Error(`till items: ${body?.error ?? response.status}`)
  return body.rows
}

export async function syncTillStock(): Promise<TillStockResult> {
  const admin = createAdminClient()
  const result: TillStockResult = { itemsCreated: [], itemsRenamed: [], countsSent: [], errors: [] }

  // 1. Items: the till's names win.
  try {
    const till = await tillItems()
    const { data: linked, error } = await admin
      .from('stock_items')
      .select('id, name, category, active, till_item_id')
      .not('till_item_id', 'is', null)
    if (error) throw new Error(error.message)
    const byTillId = new Map((linked ?? []).map((row) => [row.till_item_id as string, row]))

    for (const item of till) {
      const mine = byTillId.get(item.item_id)
      if (!mine) {
        const { error: insertError } = await admin.from('stock_items').insert({
          name: item.name,
          category: item.category,
          unit: 'ea',
          active: true,
          till_item_id: item.item_id,
        })
        if (insertError) result.errors.push(`${item.name}: ${insertError.message}`)
        else result.itemsCreated.push(item.name)
        continue
      }
      if (mine.name !== item.name || mine.category !== item.category || !mine.active) {
        const { error: updateError } = await admin
          .from('stock_items')
          .update({ name: item.name, category: item.category, active: true, updated_at: new Date().toISOString() })
          .eq('id', mine.id)
        if (updateError) result.errors.push(`${item.name}: ${updateError.message}`)
        else if (mine.name !== item.name) result.itemsRenamed.push(`${mine.name} → ${item.name}`)
      }
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e))
  }

  // 2. Counts: send any linked item counted since its last send.
  try {
    const sent = await sendCounts(admin)
    result.countsSent = sent
    for (const count of sent) if (!count.ok) result.errors.push(`${count.item_id}: ${count.detail}`)
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e))
  }
  return result
}

async function sendCounts(admin: ReturnType<typeof createAdminClient>): Promise<SentCount[]> {
  const token = process.env.TILL_STOCK_TOKEN?.trim()
  if (!token) throw new Error('TILL_STOCK_TOKEN is not set, so stock take counts cannot be sent to the till.')

  const { data: items, error } = await admin
    .from('stock_items')
    .select('id, till_item_id, till_count_sent_at, till_servings_per_unit')
    .not('till_item_id', 'is', null)
  if (error) throw new Error(error.message)
  if (!items?.length) return []
  const ids = items.map((i) => i.id)

  const [{ data: counts, error: countsError }, { data: placements, error: placementsError }] = await Promise.all([
    admin
      .from('stock_location_moves')
      .select('stock_item_id, moved_at')
      .eq('kind', 'adjust')
      .in('stock_item_id', ids)
      .order('moved_at', { ascending: false }),
    admin.from('stock_placements').select('stock_item_id, quantity').in('stock_item_id', ids),
  ])
  if (countsError) throw new Error(countsError.message)
  if (placementsError) throw new Error(placementsError.message)

  const lastCounted = new Map<string, string>()
  for (const move of counts ?? []) {
    if (!lastCounted.has(move.stock_item_id)) lastCounted.set(move.stock_item_id, move.moved_at)
  }
  const onHand = new Map<string, number>()
  for (const p of placements ?? []) {
    onHand.set(p.stock_item_id, (onHand.get(p.stock_item_id) ?? 0) + Number(p.quantity))
  }

  const due = items.flatMap((item) => {
    const countedAt = lastCounted.get(item.id)
    if (!countedAt) return []
    if (item.till_count_sent_at && new Date(item.till_count_sent_at) >= new Date(countedAt)) return []
    const servings = Number(item.till_servings_per_unit ?? 1) || 1
    const counted = Math.floor((onHand.get(item.id) ?? 0) * servings + 1e-9)
    return [{ stockItemId: item.id, item_id: item.till_item_id as string, counted, counted_at: countedAt }]
  })
  if (!due.length) return []

  const response = await fetch(`${tillBase()}/api/cafe/stock-take`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ counts: due.map(({ item_id, counted, counted_at }) => ({ item_id, counted, counted_at })) }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await response.json().catch(() => null)) as { results?: SentCount[]; detail?: string } | null
  if (!body?.results) throw new Error(`till stock take: ${body?.detail ?? response.status}`)

  for (const count of body.results) {
    if (!count.ok) continue
    const sent = due.find((d) => d.item_id === count.item_id)
    if (!sent) continue
    await admin.from('stock_items').update({ till_count_sent_at: sent.counted_at }).eq('id', sent.stockItemId)
  }
  return body.results
}
