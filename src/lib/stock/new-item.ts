import type { createAdminClient } from '@/lib/supabase/admin'

/**
 * Staff can add an item on the spot from Goods In or Wastage when it isn't in
 * the list yet. Managers tidy its details (category, unit) on /stock later.
 */

type Admin = ReturnType<typeof createAdminClient>

/** "  oat  MILK " → "Oat MILK": trimmed, single spaces, first letter capital. */
export function cleanItemName(raw: unknown): string {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}

/** A unit as typed ("Bags ", "BOX") → "bags", "box"; blank → "ea". */
export function cleanUnit(raw: unknown): string {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  return s.slice(0, 20) || 'ea'
}

/** ilike treats % and _ as wildcards; escape them so the name matches exactly. */
function exact(name: string): string {
  return name.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * The active item with this name (case doesn't matter), or a new one. Reusing a
 * match means a second person typing "oat milk" doesn't make a duplicate.
 */
export async function findOrCreateItem(
  admin: Admin,
  input: { name: string; unit: string; category: string | null },
): Promise<{ id: string; name: string; unit: string; created: boolean } | { error: string }> {
  if (input.name.length < 2) return { error: 'Type the item’s name' }
  if (input.name.length > 80) return { error: 'Keep the item name under 80 characters' }

  const { data: existing } = await admin
    .from('stock_items')
    .select('id, name, unit')
    .eq('active', true)
    .ilike('name', exact(input.name))
    .limit(1)
    .maybeSingle()
  if (existing) return { id: existing.id, name: existing.name, unit: existing.unit, created: false }

  const { data: made, error } = await admin
    .from('stock_items')
    .insert({ name: input.name, unit: input.unit, category: input.category, active: true })
    .select('id, name, unit')
    .single()
  if (error || !made) return { error: error?.message ?? 'Could not add the item' }
  return { id: made.id, name: made.name, unit: made.unit, created: true }
}
