import { createAdminClient } from '@/lib/supabase/admin'

export type BelowParItem = { id: string; name: string; par_level: number; on_hand: number }

/**
 * Active items with a par level whose whole-shop total (every location added
 * up) is at or below it. Shown on the owner and manager dashboards.
 */
export async function belowParItems(): Promise<BelowParItem[]> {
  const admin = createAdminClient()
  const [{ data: parItems }, { data: placements }] = await Promise.all([
    admin
      .from('stock_items')
      .select('id, name, par_level')
      .eq('active', true)
      .not('par_level', 'is', null),
    admin.from('stock_placements').select('stock_item_id, quantity'),
  ])

  const totalByItem = new Map<string, number>()
  for (const p of placements ?? []) {
    totalByItem.set(p.stock_item_id, (totalByItem.get(p.stock_item_id) ?? 0) + Number(p.quantity))
  }
  return (parItems ?? [])
    .map((i) => ({ id: i.id, name: i.name, par_level: Number(i.par_level), on_hand: totalByItem.get(i.id) ?? 0 }))
    .filter((i) => i.on_hand <= i.par_level)
}
