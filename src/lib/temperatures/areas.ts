// Fridges and freezers are grouped by area in the same order as the stock page
// (Café · Kitchen · Storage), so each one has one name and one place everywhere.
const AREA_ORDER = ['Counter', 'Kitchen', 'Storage']

/** Groups appliances by `location`, in area order; ones with no area come last as "Other". */
export function groupByArea<T extends { location: string | null }>(
  appliances: T[],
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>()
  for (const a of appliances) {
    const area = a.location?.trim() || 'Other'
    groups.set(area, [...(groups.get(area) ?? []), a])
  }
  const rank = (area: string) => {
    const i = AREA_ORDER.indexOf(area)
    return i === -1 ? AREA_ORDER.length : i
  }
  return [...groups.entries()].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b),
  )
}
