import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

type LocationBreakdown = { name: string; quantity: number }
type ItemResult = {
  id: string
  name: string
  unit: string
  total: number
  locations: LocationBreakdown[]
}

/**
 * Stock quick-search. Any signed-in user can look up an item by name and see
 * how many are in each location. GET /api/stock/search?q=chocolate
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ items: [] as ItemResult[] })
  }

  const admin = createAdminClient()

  // Escape the LIKE wildcards so a user typing % or _ searches literally.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

  const { data: items } = await admin
    .from('stock_items')
    .select('id, name, unit')
    .eq('active', true)
    .ilike('name', pattern)
    .order('name')
    .limit(12)

  const its = items ?? []
  if (its.length === 0) {
    return NextResponse.json({ items: [] as ItemResult[] })
  }

  const itemIds = its.map((i) => i.id)

  const [{ data: placements }, { data: locations }] = await Promise.all([
    admin
      .from('stock_placements')
      .select('stock_item_id, location_id, quantity')
      .in('stock_item_id', itemIds),
    admin
      .from('stock_locations')
      .select('id, name, sort_order')
      .eq('active', true)
      .order('sort_order')
      .order('name'),
  ])

  const locById = new Map(
    (locations ?? []).map((l, idx) => [l.id, { name: l.name, order: idx }]),
  )

  // Group placements by item, keeping only locations that actually hold stock.
  const byItem = new Map<string, Array<LocationBreakdown & { order: number }>>()
  const totalByItem = new Map<string, number>()
  for (const p of placements ?? []) {
    const qty = Number(p.quantity)
    if (!qty) continue
    const loc = locById.get(p.location_id)
    if (!loc) continue
    const list = byItem.get(p.stock_item_id) ?? []
    list.push({ name: loc.name, quantity: qty, order: loc.order })
    byItem.set(p.stock_item_id, list)
    totalByItem.set(
      p.stock_item_id,
      (totalByItem.get(p.stock_item_id) ?? 0) + qty,
    )
  }

  const results: ItemResult[] = its.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    total: totalByItem.get(i.id) ?? 0,
    locations: (byItem.get(i.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map(({ name, quantity }) => ({ name, quantity })),
  }))

  return NextResponse.json({ items: results })
}
