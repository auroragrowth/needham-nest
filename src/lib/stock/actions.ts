'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

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

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

function parseItem(formData: FormData) {
  const sku = String(formData.get('sku') ?? '').trim() || null
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim() || null
  const unit = String(formData.get('unit') ?? '').trim() || 'ea'
  const par = String(formData.get('par_level') ?? '').trim()
  const reorder = String(formData.get('reorder_at') ?? '').trim()
  const cost = String(formData.get('cost_price') ?? '').trim()
  const supplier_name =
    String(formData.get('supplier_name') ?? '').trim() || null

  return {
    sku,
    name,
    category,
    unit,
    par_level: par === '' ? null : Number(par),
    reorder_at: reorder === '' ? null : Number(reorder),
    cost_price: cost === '' ? null : Number(cost),
    supplier_name,
  }
}

export async function createItem(formData: FormData) {
  await requireOwner()
  const payload = parseItem(formData)
  if (!payload.name) {
    redirect('/owner/stock/new?error=Name+is+required')
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('stock_items')
    .insert({ ...payload, active: true })
    .select('id')
    .single()
  if (error || !data) {
    redirect(
      `/owner/stock/new?error=${encodeURIComponent(error?.message ?? 'Failed')}`,
    )
  }
  revalidatePath('/owner/stock')
  revalidatePath('/staff/wastage')
  revalidatePath('/staff/stock-count')
  redirect(`/owner/stock/${data.id}?notice=Item+added`)
}

export async function updateItem(id: string, formData: FormData) {
  await requireOwner()
  const payload = parseItem(formData)
  if (!payload.name) {
    redirect(`/owner/stock/${id}?error=Name+is+required`)
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('stock_items')
    .update(payload)
    .eq('id', id)
  if (error) {
    redirect(`/owner/stock/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/stock')
  revalidatePath(`/owner/stock/${id}`)
  revalidatePath('/staff/wastage')
  revalidatePath('/staff/stock-count')
  redirect(`/owner/stock/${id}?notice=Saved`)
}

async function setItemActive(id: string, active: boolean) {
  await requireOwner()
  const admin = createAdminClient()
  const { error } = await admin
    .from('stock_items')
    .update({ active })
    .eq('id', id)
  if (error) {
    redirect(`/owner/stock/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/stock')
  revalidatePath(`/owner/stock/${id}`)
  revalidatePath('/staff/wastage')
  revalidatePath('/staff/stock-count')
  redirect(
    `/owner/stock/${id}?notice=${active ? 'Reactivated' : 'Deactivated'}`,
  )
}
export async function deactivateItem(id: string) {
  await setItemActive(id, false)
}
export async function reactivateItem(id: string) {
  await setItemActive(id, true)
}

/** Staff logs wastage for a specific item. */
export async function recordWastage(itemId: string, formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'staff') {
    redirect('/?error=Only+staff+log+wastage')
  }

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

/**
 * Staff submits a batch stock count. FormData carries `count_{itemId}` keys.
 * We insert one stock_counts row per item that has a value entered.
 */
export async function recordStockCount(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'staff') {
    redirect('/?error=Only+staff+count+stock')
  }

  const notes = String(formData.get('notes') ?? '').trim() || null

  const rows: Array<{
    stock_item_id: string
    user_id: string
    on_hand: number
    notes: string | null
  }> = []

  for (const [k, v] of formData.entries()) {
    if (!k.startsWith('count_')) continue
    const itemId = k.slice('count_'.length)
    const str = String(v ?? '').trim()
    if (str === '') continue
    const n = Number(str)
    if (!Number.isFinite(n) || n < 0) continue
    rows.push({
      stock_item_id: itemId,
      user_id: session.profileId,
      on_hand: n,
      notes,
    })
  }

  if (rows.length === 0) {
    redirect('/staff/stock-count?error=Enter+at+least+one+count')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('stock_counts').insert(rows)

  if (error) {
    redirect(`/staff/stock-count?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/staff/stock-count')
  revalidatePath('/staff')
  redirect(`/staff/stock-count?notice=Saved+${rows.length}+count${rows.length === 1 ? '' : 's'}`)
}
