'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature, requireStockControl } from '@/lib/permissions'
import { parseWastage } from '@/lib/stock/wastage'
import { getShiftWaste } from '@/lib/stock/waste-confirm'
import { getClosingStatus } from '@/lib/checklist/closing'


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

/**
 * Staff logs wastage for a specific item: how much, when it was wasted (UK date
 * and time), the reason category and, in words, why.
 */
export async function recordWastage(itemId: string, formData: FormData) {
  const session = await requireStaffFeature('wastage')

  const parsed = parseWastage(
    {
      quantity: formData.get('quantity'),
      day: formData.get('wasted_day'),
      time: formData.get('wasted_time'),
      reason: formData.get('reason'),
      why: formData.get('why'),
    },
    new Date(),
  )
  if ('error' in parsed) {
    redirect(`/staff/wastage/${itemId}?error=${encodeURIComponent(parsed.error)}`)
  }
  const { entry } = parsed

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
    quantity: entry.quantity,
    unit_cost: item?.cost_price ?? null,
    wastage_reason: entry.reason,
    notes: entry.why,
    date: entry.day,
    wasted_at: entry.wastedAt.toISOString(),
  })

  if (error) {
    redirect(`/staff/wastage/${itemId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff/wastage')
  revalidatePath('/staff')
  revalidatePath('/manager')
  revalidatePath('/manager/wastage')
  redirect('/staff/wastage?notice=Wastage+recorded')
}

/**
 * Each person confirms the waste from their own shift before clocking out:
 * "all logged" or "nothing wasted". Recorded per shift in waste_confirmations,
 * and the closer's confirmation also ticks the closing list's waste job.
 */
export async function confirmMyWaste(formData: FormData) {
  const session = await requireStaffFeature('wastage')
  const admin = createAdminClient()

  const state = await getShiftWaste(session.profileId)
  if (!state.shift) {
    redirect('/staff/wastage?error=You+are+not+clocked+in%2C+so+there+is+nothing+to+confirm')
  }
  const entries = state.mine.length
  if (entries === 0 && formData.get('nothing_wasted') !== 'yes') {
    redirect('/staff/wastage?error=Log+your+waste%2C+or+confirm+you+wasted+nothing')
  }

  const { error } = await admin.from('waste_confirmations').upsert({
    time_log_id: state.shift.id,
    user_id: session.profileId,
    confirmed_at: new Date().toISOString(),
    entries,
    nothing_wasted: entries === 0,
  })
  if (error) redirect(`/staff/wastage?error=${encodeURIComponent(error.message)}`)

  // Closing up: the waste job on the closing list is this same check.
  const closing = await getClosingStatus(session.profileId)
  if (closing.isLastOnShift) {
    const { data: wasteTasks } = await admin
      .from('cleaning_tasks')
      .select('id')
      .eq('active', true)
      .eq('frequency', 'close')
      .like('link_href', '/staff/wastage%')
    for (const t of wasteTasks ?? []) {
      // A second tick today hits the one-per-day index; that's fine.
      await admin.from('cleaning_log').insert({ task_id: t.id, user_id: session.profileId })
    }
  }

  revalidatePath('/staff/wastage')
  revalidatePath('/staff/checklist')
  revalidatePath('/staff')
  revalidatePath('/staff/clock')
  revalidatePath('/manager/compliance')
  redirect(
    formData.get('clockout') === '1'
      ? '/staff/clock?action=clock-out&notice=Waste+confirmed'
      : '/staff/wastage?notice=Waste+confirmed+for+your+shift',
  )
}
