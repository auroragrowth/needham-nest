/**
 * Sales insights from the till, for the owner's Insights screen on the iPad.
 *
 * The till is the record of what sold, so this reads it rather than keeping a
 * copy: one call to /api/hub/report/insights (report_insights in the till's
 * database) returns everything the screen shows. Money is in pence, days are
 * London days, both ends included.
 *
 * Needs TILL_URL and TILL_READ_TOKEN, the same pair the stock sync uses.
 */

export type InsightItem = {
  id: string | null
  name: string
  category: string
  qty: number
  net: number
  orders: number
  prev_qty: number
  prev_net: number
  peak_hour: number | null
  best_dow: number | null
  share_pct: number | null
  price: number | null
  /** Pence to make one, or null when it is not known yet. */
  unit_cost: number | null
  cost_source: 'set by hand' | 'recipe' | 'recipe partly costed' | 'no recipe' | null
  recipe_lines: number | null
  costed_lines: number | null
  profit: number | null
  margin_pct: number | null
  target_min: number | null
  target_max: number | null
}

export type Insights = {
  range: { from: string; to: string; days: number }
  totals: {
    orders: number
    takings: number
    discounts: number
    avg_spend: number
    days_traded: number
    items_sold: number
    prev_orders: number
    prev_takings: number
    prev_avg_spend: number
    prev_days_traded: number
  }
  daily: { date: string; dow: number; orders: number; takings: number }[]
  weekdays: { dow: number; days: number; avg_orders: number; avg_takings: number; best: number; worst: number }[]
  hours: { hour: number; avg_orders: number; avg_takings: number; share_pct: number }[]
  heatmap: { dow: number; hour: number; avg_takings: number; avg_orders: number }[]
  items: InsightItem[]
  item_hours: { name: string; hour: number; qty: number }[]
  categories: { category: string; qty: number; net: number; prev_net: number; share_pct: number | null }[]
  not_selling: { id: string; name: string; category: string; price: number; qty: number; last_sold: string | null }[]
  order_types: { type: string; orders: number; takings: number; avg_spend: number }[]
  payments: { type: string; orders: number; takings: number }[]
  basket: { items_per_order: number | null; one_item_orders_pct: number | null }
  costing: {
    ingredient_costs: number
    ingredients: number
    items_with_recipe: number
    items_costed: number
    active_items: number
  }
}

export async function tillInsights(from: string, to: string): Promise<Insights> {
  const base = process.env.TILL_URL?.replace(/\/+$/, '')
  if (!base) throw new Error('TILL_URL is not set.')
  const token = process.env.TILL_READ_TOKEN?.trim()
  if (!token) throw new Error('TILL_READ_TOKEN is not set, so the till cannot be read.')

  const url = `${base}/api/hub/report/insights?from=${from}&to=${to}`
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await response.json().catch(() => null)) as { insights?: Insights; error?: string } | null
  if (!response.ok || !body?.insights) throw new Error(`till insights: ${body?.error ?? response.status}`)
  return body.insights
}
