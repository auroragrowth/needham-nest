/**
 * The tablet's three sections. A section's colour runs from its tile on the hub,
 * through the bar under the header, into every page inside it — so staff always
 * know where they are. Red belongs to Compliance alone.
 */
export type SectionKey = 'people' | 'compliance' | 'stock'

export const SECTIONS: Record<
  SectionKey,
  { label: string; tile: string; bar: string; heading: string; ink: string }
> = {
  people: {
    label: 'People',
    tile: 'border-people bg-people-tint',
    bar: 'bg-people text-white',
    heading: 'text-people-ink',
    ink: 'text-people-ink',
  },
  compliance: {
    label: 'Compliance',
    tile: 'border-compliance bg-compliance-tint',
    bar: 'bg-compliance text-white',
    heading: 'text-compliance-ink',
    ink: 'text-compliance-ink',
  },
  stock: {
    label: 'Stock',
    tile: 'border-stock bg-stock-tint',
    bar: 'bg-stock text-white',
    heading: 'text-stock-ink',
    ink: 'text-stock-ink',
  },
}

/** Tablet pages and the section and name they sit under. Longest prefix wins. */
const PAGES: { path: string; section: SectionKey; name: string }[] = [
  { path: '/staff/clock', section: 'people', name: 'Clock in/out' },
  { path: '/staff/rota', section: 'people', name: 'Rota' },
  { path: '/staff/handover', section: 'people', name: 'Handover notes' },
  { path: '/staff/availability', section: 'people', name: 'Availability' },
  { path: '/staff/leave', section: 'people', name: 'Leave' },
  { path: '/staff/allergens', section: 'compliance', name: 'Allergen matrix' },
  { path: '/staff/temperatures', section: 'compliance', name: 'Fridge temps' },
  { path: '/staff/cooked-meats', section: 'compliance', name: 'Fridge temps' },
  { path: '/staff/checklist', section: 'compliance', name: 'Cleaning checklists' },
  { path: '/staff/accident', section: 'compliance', name: 'Accident book' },
  { path: '/staff/eho', section: 'compliance', name: 'EHO pack' },
  { path: '/risk-assessments', section: 'compliance', name: 'EHO pack · Risk assessments' },
  { path: '/stock/goods-in', section: 'stock', name: 'Goods in' },
  { path: '/stock', section: 'stock', name: 'Stock counts' },
  { path: '/staff/wastage', section: 'stock', name: 'Wastage' },
  { path: '/shopping-list', section: 'stock', name: 'Shopping list' },
  { path: '/invoices', section: 'stock', name: 'Invoice or receipt' },
]

export function pageSection(
  pathname: string,
): { section: SectionKey; name: string } | null {
  let best: (typeof PAGES)[number] | null = null
  for (const p of PAGES) {
    if (pathname === p.path || pathname.startsWith(p.path + '/')) {
      if (!best || p.path.length > best.path.length) best = p
    }
  }
  return best && { section: best.section, name: best.name }
}
