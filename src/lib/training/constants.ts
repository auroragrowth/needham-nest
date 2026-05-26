export const TRAINING_TYPES = [
  { value: 'food_hygiene_l2', label: 'Food Hygiene Level 2' },
  { value: 'allergen_awareness', label: 'Allergen awareness' },
  { value: 'first_aid', label: 'First aid' },
  { value: 'fire_safety', label: 'Fire safety' },
  { value: 'haccp', label: 'HACCP' },
  { value: 'other', label: 'Other' },
] as const

export type TrainingType = (typeof TRAINING_TYPES)[number]['value']
