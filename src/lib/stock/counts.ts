/**
 * Turning a stock-take form into count changes. Pure, so it can be tested.
 *
 * Each item has a `count_<itemId>` box, prefilled with the current count. A
 * blank box means "not counted" and is skipped; 0 means none there. Only
 * counts that differ from what's recorded become changes, except for items in
 * `alwaysRecord` (till items): the till sells them without the count here
 * going down, so any number typed is a fresh count the till needs to hear.
 */

export type CountChange = { itemId: string; quantity: number; previous: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseCounts(
  entries: Iterable<[string, unknown]>,
  current: Map<string, number>,
  alwaysRecord: Set<string> = new Set(),
): { changes: CountChange[]; invalid: string[] } {
  const changes: CountChange[] = []
  const invalid: string[] = []
  const seen = new Set<string>()
  for (const [key, value] of entries) {
    if (!key.startsWith('count_')) continue
    const itemId = key.slice('count_'.length)
    if (!UUID.test(itemId) || seen.has(itemId)) continue
    const raw = String(value ?? '').trim()
    if (raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) {
      invalid.push(itemId)
      continue
    }
    seen.add(itemId)
    const quantity = Number(n.toFixed(3))
    const previous = current.get(itemId) ?? 0
    if (quantity !== previous || alwaysRecord.has(itemId)) changes.push({ itemId, quantity, previous })
  }
  return { changes, invalid }
}
