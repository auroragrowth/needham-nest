export const EXPENSE_CATEGORIES = [
  { value: 'food_purchases', label: 'Food purchases' },
  { value: 'drink_purchases', label: 'Drink purchases' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'rent_utilities', label: 'Rent / utilities' },
  { value: 'repairs_maintenance', label: 'Repairs / maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'staff', label: 'Staff (wages, training)' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value']

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
)

export const TAKINGS_SOURCES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'sumup', label: 'SumUp' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
] as const

export type TakingsSource = (typeof TAKINGS_SOURCES)[number]['value']

export const TAKINGS_SOURCE_LABEL: Record<string, string> = Object.fromEntries(
  TAKINGS_SOURCES.map((s) => [s.value, s.label]),
)
