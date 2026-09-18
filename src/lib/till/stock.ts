import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Till items, kept in step with the stock take.
 *
 * Every item the till wants counted has a stock_item here, linked by
 * till_item_id, with the till's name and category. A new till item appears here
 * ready to count; a renamed one is renamed here. An item already set up here
 * under the same name, not yet linked, is linked rather than duplicated, so its
 * count and its place in the stock take are kept.
 *
 * The counts are this app's own. Until 18 Sep 2026 they were also sent to the
 * till; the till no longer keeps counts, and instead says what selling used —
 * see usage.ts, which takes that off the shelves.
 *
 * The sync only ever changes name, category and active on a linked item, never
 * its unit. Needs TILL_URL and TILL_READ_TOKEN (the till's HUB_READ_TOKEN).
 */

type TillStockRow = { item_id: string; name: string; category: string | null }

export type TillStockResult = {
  itemsCreated: string[]
  itemsLinked: string[]
  itemsRenamed: string[]
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
  const result: TillStockResult = { itemsCreated: [], itemsLinked: [], itemsRenamed: [], errors: [] }

  // 1. Items: the till's names win.
  try {
    const till = await tillItems()
    const { data: all, error } = await admin
      .from('stock_items')
      .select('id, name, category, unit, active, till_item_id')
    if (error) throw new Error(error.message)
    const byTillId = new Map(
      (all ?? []).filter((row) => row.till_item_id).map((row) => [row.till_item_id as string, row]),
    )
    // An item somebody already set up here, waiting to be linked: same name, no
    // till item yet. Linking it keeps its count instead of making a second row.
    const unlinkedByName = new Map(
      (all ?? [])
        .filter((row) => !row.till_item_id && row.active)
        .map((row) => [row.name.trim().toLowerCase(), row]),
    )

    for (const item of till) {
      const mine = byTillId.get(item.item_id)
      if (!mine) {
        const existing = unlinkedByName.get(item.name.trim().toLowerCase())
        if (existing) {
          const { error: linkError } = await admin
            .from('stock_items')
            .update({ till_item_id: item.item_id, category: item.category, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .is('till_item_id', null)
          if (linkError) result.errors.push(`${item.name}: ${linkError.message}`)
          else result.itemsLinked.push(`${item.name} (${existing.unit})`)
          continue
        }
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

  return result
}
