'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStockControl } from '@/lib/permissions'
import { parseCounts } from '@/lib/stock/counts'
import { cleanItemName, cleanUnit, findOrCreateItem } from '@/lib/stock/new-item'

/**
 * Every change to how much stock is where. stock_placements (item × location ×
 * quantity) is the one record of stock; each change here is also logged in
 * stock_location_moves.
 */

async function requireSignedIn() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

function toNumber(raw: FormDataEntryValue | null): number {
  const s = String(raw ?? '').trim()
  if (!s) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

/** Where to go afterwards: only somewhere on the stock page, never off-site. */
function backTo(formData: FormData): string {
  const back = String(formData.get('back') ?? '')
  return back.startsWith('/stock') && !back.startsWith('//') ? back : '/stock'
}

function withParam(url: string, key: string, value: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`
}

async function upsertPlacement(
  admin: ReturnType<typeof createAdminClient>,
  itemId: string,
  locationId: string,
  delta: number,
  userId: string | null,
): Promise<{ previous: number; next: number } | { error: string }> {
  const { data: existing } = await admin
    .from('stock_placements')
    .select('id, quantity')
    .eq('stock_item_id', itemId)
    .eq('location_id', locationId)
    .maybeSingle()

  const previous = existing ? Number(existing.quantity) : 0
  const next = Number((previous + delta).toFixed(3))
  if (next < 0) return { error: 'Not enough stock at that location' }

  if (existing) {
    const { error } = await admin
      .from('stock_placements')
      .update({ quantity: next, updated_at: new Date().toISOString(), updated_by: userId })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('stock_placements').insert({
      stock_item_id: itemId,
      location_id: locationId,
      quantity: next,
      updated_by: userId,
    })
    if (error) return { error: error.message }
  }
  return { previous, next }
}

/** Set one count directly. Used for a single item; the stock take uses saveLocationCounts. */
async function setCount(
  admin: ReturnType<typeof createAdminClient>,
  itemId: string,
  locationId: string,
  quantity: number,
  previous: number,
  hasRow: boolean,
  userId: string,
  notes: string | null,
) {
  if (hasRow) {
    const { error } = await admin
      .from('stock_placements')
      .update({ quantity, updated_at: new Date().toISOString(), updated_by: userId })
      .eq('stock_item_id', itemId)
      .eq('location_id', locationId)
    if (error) return error.message
  } else {
    const { error } = await admin
      .from('stock_placements')
      .insert({ stock_item_id: itemId, location_id: locationId, quantity, updated_by: userId })
    if (error) return error.message
  }
  await admin.from('stock_location_moves').insert({
    stock_item_id: itemId,
    from_location_id: null,
    to_location_id: locationId,
    quantity: quantity - previous,
    kind: 'adjust',
    previous_quantity: previous,
    new_quantity: quantity,
    notes,
    moved_by: userId,
  })
  return null
}

/** Stock take: save every changed count for one location in one go. */
export async function saveLocationCounts(formData: FormData) {
  const session = await requireSignedIn()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const back = backTo(formData)
  if (!locationId) redirect(withParam(back, 'error', 'Pick a location'))

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('stock_placements')
    .select('stock_item_id, quantity')
    .eq('location_id', locationId)
  const current = new Map((rows ?? []).map((r) => [r.stock_item_id, Number(r.quantity)]))

  // "Add an item here" arrives as a picked item and a count; treat it like any other box.
  const entries: [string, unknown][] = [...formData.entries()]
  const newItem = String(formData.get('new_item_id') ?? '').trim()
  if (newItem) entries.push([`count_${newItem}`, formData.get('new_item_count')])

  const { data: tillItems } = await admin.from('stock_items').select('id').not('till_item_id', 'is', null)
  const { changes, invalid } = parseCounts(entries, current, new Set((tillItems ?? []).map((i) => i.id)))
  if (invalid.length > 0) {
    redirect(withParam(back, 'error', 'Counts must be 0 or more — nothing was saved.'))
  }
  if (changes.length === 0) redirect(withParam(back, 'notice', 'No counts changed'))

  for (const change of changes) {
    const failed = await setCount(
      admin, change.itemId, locationId, change.quantity, change.previous,
      current.has(change.itemId), session.profileId, 'Stock take',
    )
    if (failed) redirect(withParam(back, 'error', failed))
  }

  revalidatePath('/stock')
  redirect(withParam(back, 'notice', `Counted ${changes.length} item${changes.length === 1 ? '' : 's'}`))
}

/** Move N of item from location A to location B. */
export async function moveStock(formData: FormData) {
  const session = await requireSignedIn()
  const itemId = String(formData.get('stock_item_id') ?? '').trim()
  const from = String(formData.get('from_location_id') ?? '').trim()
  const to = String(formData.get('to_location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const back = backTo(formData)

  if (!itemId || !from || !to || !Number.isFinite(qty) || qty <= 0) {
    redirect(withParam(back, 'error', 'Pick where to move it and how many'))
  }
  if (from === to) redirect(withParam(back, 'error', 'Pick a different location to move it to'))

  const admin = createAdminClient()
  const outRes = await upsertPlacement(admin, itemId, from, -qty, session.profileId)
  if ('error' in outRes) redirect(withParam(back, 'error', outRes.error))
  const inRes = await upsertPlacement(admin, itemId, to, qty, session.profileId)
  if ('error' in inRes) {
    // roll back the -qty we just applied
    await upsertPlacement(admin, itemId, from, qty, session.profileId)
    redirect(withParam(back, 'error', inRes.error))
  }

  await admin.from('stock_location_moves').insert({
    stock_item_id: itemId,
    from_location_id: from,
    to_location_id: to,
    quantity: qty,
    kind: 'move',
    previous_quantity: outRes.previous,
    new_quantity: outRes.next,
    notes,
    moved_by: session.profileId,
  })

  revalidatePath('/stock')
  redirect(withParam(back, 'notice', `Moved ${qty}`))
}

/** Set an absolute count for one item at a location. */
export async function adjustPlacement(formData: FormData) {
  const session = await requireSignedIn()
  const itemId = String(formData.get('stock_item_id') ?? '').trim()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const back = backTo(formData)

  if (!itemId || !locationId || !Number.isFinite(qty) || qty < 0) {
    redirect(withParam(back, 'error', 'Enter a count of 0 or more'))
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('stock_placements')
    .select('quantity')
    .eq('stock_item_id', itemId)
    .eq('location_id', locationId)
    .maybeSingle()
  const failed = await setCount(
    admin, itemId, locationId, qty, existing ? Number(existing.quantity) : 0,
    Boolean(existing), session.profileId, notes,
  )
  if (failed) redirect(withParam(back, 'error', failed))

  revalidatePath('/stock')
  redirect(withParam(back, 'notice', `Count set to ${qty}`))
}

/** New stock arriving at a location. */
export async function receiveStock(formData: FormData) {
  const session = await requireSignedIn()
  const itemId = String(formData.get('stock_item_id') ?? '').trim()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const back = backTo(formData)

  if (!itemId || !locationId || !Number.isFinite(qty) || qty <= 0) {
    redirect(withParam(back, 'error', 'Pick an item and how many arrived'))
  }

  const admin = createAdminClient()
  const res = await upsertPlacement(admin, itemId, locationId, qty, session.profileId)
  if ('error' in res) redirect(withParam(back, 'error', res.error))

  await admin.from('stock_location_moves').insert({
    stock_item_id: itemId,
    from_location_id: null,
    to_location_id: locationId,
    quantity: qty,
    kind: 'receive',
    previous_quantity: res.previous,
    new_quantity: res.next,
    notes,
    moved_by: session.profileId,
  })

  const [{ data: item }, { data: place }] = await Promise.all([
    admin.from('stock_items').select('name, unit').eq('id', itemId).maybeSingle(),
    admin.from('stock_locations').select('name').eq('id', locationId).maybeSingle(),
  ])

  revalidatePath('/stock')
  revalidatePath('/stock/goods-in')
  redirect(
    withParam(
      back,
      'notice',
      item && place ? `Added ${qty} ${item.unit} ${item.name} to ${place.name}` : `Added ${qty}`,
    ),
  )
}

/**
 * Goods In for something that isn't in the list yet: add it as a stock item
 * (or reuse one with the same name), then book the delivery in as usual.
 */
export async function receiveNewStock(formData: FormData) {
  const session = await requireSignedIn()
  const back = backTo(formData)
  const name = cleanItemName(formData.get('new_name'))
  const unit = cleanUnit(formData.get('new_unit'))
  const category = String(formData.get('new_category') ?? '').trim() || 'Other'
  const locationId = String(formData.get('location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))

  if (!locationId || !Number.isFinite(qty) || qty <= 0) {
    redirect(withParam(back, 'error', 'Say how many arrived and where it’s going'))
  }

  const admin = createAdminClient()
  const item = await findOrCreateItem(admin, { name, unit, category })
  if ('error' in item) redirect(withParam(back, 'error', item.error))

  const res = await upsertPlacement(admin, item.id, locationId, qty, session.profileId)
  if ('error' in res) redirect(withParam(back, 'error', res.error))

  await admin.from('stock_location_moves').insert({
    stock_item_id: item.id,
    from_location_id: null,
    to_location_id: locationId,
    quantity: qty,
    kind: 'receive',
    previous_quantity: res.previous,
    new_quantity: res.next,
    notes: item.created ? `Goods in — new item added by ${session.name}` : 'Goods in',
    moved_by: session.profileId,
  })

  const { data: place } = await admin.from('stock_locations').select('name').eq('id', locationId).maybeSingle()
  revalidatePath('/stock')
  revalidatePath('/stock/goods-in')
  redirect(
    withParam(
      back,
      'notice',
      `${item.created ? 'New item added: ' : 'Added '}${qty} ${item.unit} ${item.name}${place ? ` to ${place.name}` : ''}`,
    ),
  )
}

const ZONES = ['kitchen', 'cafe', 'storage', 'other'] as const

/** Managers: add a location to an area. */
export async function createLocation(formData: FormData) {
  await requireStockControl()
  const name = String(formData.get('name') ?? '').trim()
  const zoneRaw = String(formData.get('zone') ?? '').trim()
  const zone = (ZONES as readonly string[]).includes(zoneRaw) ? zoneRaw : 'other'
  const cold_type = String(formData.get('cold_type') ?? '').trim() || null
  const back = `/stock?tab=${zone}`
  if (!name) redirect(withParam(back, 'error', 'Give the location a name'))

  const admin = createAdminClient()
  const { error } = await admin.from('stock_locations').insert({ name, zone, cold_type, active: true })
  if (error) redirect(withParam(back, 'error', error.message))
  revalidatePath('/stock')
  redirect(withParam(back, 'notice', `Added ${name}`))
}

/** Managers: remove a location. Soft delete, so its history stays. */
export async function deactivateLocation(id: string) {
  await requireStockControl()
  const admin = createAdminClient()
  const { data: loc } = await admin.from('stock_locations').select('name, zone').eq('id', id).maybeSingle()
  const back = `/stock?tab=${loc?.zone ?? 'overall'}`
  // A removed location's stock would silently drop out of the totals.
  const { count } = await admin
    .from('stock_placements')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', id)
    .gt('quantity', 0)
  if (count) {
    redirect(withParam(back, 'error', `${loc?.name ?? 'That location'} still has stock in it — move it or count it to 0 first`))
  }
  await admin.from('stock_locations').update({ active: false }).eq('id', id)
  revalidatePath('/stock')
  redirect(withParam(back, 'notice', `Removed ${loc?.name ?? 'location'}`))
}
