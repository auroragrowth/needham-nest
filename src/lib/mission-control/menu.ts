/**
 * The menu from Mission Control, which is master for recipes and allergens (Paul, 1 Oct
 * 2026). The iPad only reads it. Allergens here are the live matrix: rolled up from each
 * ingredient's label and signed off by Paul or May.
 *
 * Needs MISSION_CONTROL_URL and MISSION_CONTROL_FEED_TOKEN (a feed-scoped token from
 * Mission Control's hub_tokens). Returns null when either is unset or Mission Control does
 * not answer, so callers fall back rather than show an empty list.
 */

export type McMark = { code: string; status: 'contains' | 'may_contain' }

export type McDish = {
  id: string
  till_item_id: string | null
  name: string
  section: string | null
  price: number
  active: boolean
  allergens_signed_off: boolean
  allergens_signed_off_at: string | null
  allergens_signed_off_by: string | null
  allergens: McMark[]
}

/** Mission Control's codes, as the café app has always named them. */
export const CAFE_CODE: Record<string, string> = {
  cereals_gluten: 'gluten',
  soya: 'soybeans',
}

export async function missionControlMenu(): Promise<{ as_of: string; dishes: McDish[] } | null> {
  const base = process.env.MISSION_CONTROL_URL?.trim().replace(/\/+$/, '')
  const token = process.env.MISSION_CONTROL_FEED_TOKEN?.trim()
  if (!base || !token) return null
  try {
    const res = await fetch(`${base}/api/feed/needham-nest/menu`, {
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return (await res.json()) as { as_of: string; dishes: McDish[] }
  } catch {
    return null
  }
}
