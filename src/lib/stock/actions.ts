'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature, requireStockControl } from '@/lib/permissions'

const WASTAGE_REASONS = [
  'out_of_date',
  'damaged',
  'dropped',
  'customer_return',
  'spillage',
  'mistake',
  'other',
] as const
type WastageReason = (typeof WASTAGE_REASONS)[number]


/**
 * Item fields from a form. Only fields the form actually sends are included,
 * so an edit from the stock page (name, category, unit) never blanks par
 * levels, cost prices or suppliers kept for later.
 */
function parseItem(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? '').trim()
  const num = (key: string) => (text(key) === '' ? null : Number(text(key)))
  const payload: Record<string, string | number | null> = {}
  if (formData.has('name')) payload.name = text('name')
  if (formData.has('sku')) payload.sku = text('sku') || null
  if (formData.has('category')) payload.category = text('category') || null
  if (formData.has('unit')) payload.unit = text('unit') || 'ea'
  if (formData.has('par_level')) payload.par_level = num('par_level')
  if (formData.has('reorder_at')) payload.reorder_at = num('reorder_at')
  if (formData.has('cost_price')) payload.cost_price = num('cost_price')
  if (formData.has('supplier_name')) payload.supplier_name = text('supplier_name') || null
  // Till items: how many till servings one counted unit makes (e.g. a 7L post-mix bag-in-box).
  if (formData.has('till_servings_per_unit')) payload.till_servings_per_unit = num('till_servings_per_unit')
  return payload
}

const STOCK = '/stock?tab=overall'

function revalidateStock() {
  revalidatePath('/stock')
  revalidatePath('/staff/wastage')
}

export async function createItem(formData: FormData) {
  await requireStockControl()
  const payload = parseItem(formData)
  if (!payload.name) redirect(`${STOCK}&error=Name+is+required`)
  const admin = createAdminClient()
  const { error } = await admin
    .from('stock_items')
    .insert({ unit: 'ea', ...payload, active: true })
  if (error) redirect(`${STOCK}&error=${encodeURIComponent(error.message)}`)
  revalidateStock()
  redirect(`${STOCK}&q=${encodeURIComponent(String(payload.name))}&notice=${encodeURIComponent(`Added ${payload.name}`)}`)
}

export async function updateItem(id: string, formData: FormData) {
  await requireStockControl()
  const payload = parseItem(formData)
  const admin = createAdminClient()
  const { data: item } = await admin
    .from('stock_items')
    .select('till_item_id, unit, till_servings_per_unit')
    .eq('id', id)
    .maybeSingle()
  if (item?.till_item_id) {
    // The till sync keeps these in step with the till every 15 minutes.
    delete payload.name
    delete payload.category
    // A new unit or servings figure changes what the till should hold, so the
    // sync resends the last count (it resends whenever this is null).
    const unitChanged = 'unit' in payload && payload.unit !== item.unit
    const servingsChanged =
      'till_servings_per_unit' in payload &&
      (payload.till_servings_per_unit ?? null) !==
        (item.till_servings_per_unit === null ? null : Number(item.till_servings_per_unit))
    if (unitChanged || servingsChanged) payload.till_count_sent_at = null
  }
  if ('name' in payload && !payload.name) redirect(`${STOCK}&error=Name+is+required`)
  const servings = payload.till_servings_per_unit
  if (servings !== undefined && servings !== null && !(Number(servings) > 0)) {
    redirect(`${STOCK}&error=${encodeURIComponent('Servings must be more than 0, or blank for 1 each')}`)
  }
  const { error } = await admin.from('stock_items').update(payload).eq('id', id)
  if (error) redirect(`${STOCK}&error=${encodeURIComponent(error.message)}`)
  revalidateStock()
  redirect(`${STOCK}&notice=Saved`)
}

async function setItemActive(id: string, active: boolean) {
  await requireStockControl()
  const admin = createAdminClient()
  const { error } = await admin.from('stock_items').update({ active }).eq('id', id)
  if (error) redirect(`${STOCK}&error=${encodeURIComponent(error.message)}`)
  revalidateStock()
  redirect(`${STOCK}&notice=${active ? 'Item+restored' : 'Item+removed+(its+history+is+kept)'}`)
}
export async function deactivateItem(id: string) {
  await setItemActive(id, false)
}
export async function reactivateItem(id: string) {
  await setItemActive(id, true)
}

/** Staff logs wastage for a specific item. */
export async function recordWastage(itemId: string, formData: FormData) {
  const session = await requireStaffFeature('wastage')

  const quantity = Number(formData.get('quantity'))
  const reasonRaw = String(formData.get('reason') ?? '').trim()
  const reason = (WASTAGE_REASONS as readonly string[]).includes(reasonRaw)
    ? (reasonRaw as WastageReason)
    : null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!Number.isFinite(quantity) || quantity <= 0) {
    redirect(`/staff/wastage/${itemId}?error=Quantity+must+be+greater+than+0`)
  }
  if (!reason) {
    redirect(`/staff/wastage/${itemId}?error=Pick+a+reason`)
  }

  const admin = createAdminClient()
  // Snapshot cost price for cost reporting
  const { data: item } = await admin
    .from('stock_items')
    .select('cost_price')
    .eq('id', itemId)
    .maybeSingle()

  const { error } = await admin.from('stock_movements').insert({
    stock_item_id: itemId,
    user_id: session.profileId,
    direction: 'out',
    quantity,
    unit_cost: item?.cost_price ?? null,
    wastage_reason: reason,
    notes,
  })

  if (error) {
    redirect(`/staff/wastage/${itemId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff/wastage')
  revalidatePath('/staff')
  revalidatePath('/manager')
  redirect('/staff/wastage?notice=Wastage+recorded')
}
