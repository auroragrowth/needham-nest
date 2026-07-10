'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSignedIn() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

function toNumber(raw: FormDataEntryValue | null): number {
  const s = String(raw ?? '').trim()
  if (!s) return NaN
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
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

/** Move N of item from location A to location B. */
export async function moveStock(formData: FormData) {
  const session = await requireSignedIn()
  const itemId = String(formData.get('stock_item_id') ?? '').trim()
  const from = String(formData.get('from_location_id') ?? '').trim()
  const to = String(formData.get('to_location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const back = String(formData.get('back') ?? '/stock/locations')

  if (!itemId || !from || !to || !Number.isFinite(qty) || qty <= 0) {
    redirect(`${back}?error=Missing+item%2C+locations+or+quantity`)
  }
  if (from === to) {
    redirect(`${back}?error=Pick+two+different+locations`)
  }

  const admin = createAdminClient()

  const outRes = await upsertPlacement(admin, itemId, from, -qty, session.profileId)
  if ('error' in outRes) redirect(`${back}?error=${encodeURIComponent(outRes.error)}`)
  const inRes = await upsertPlacement(admin, itemId, to, qty, session.profileId)
  if ('error' in inRes) {
    // roll back the -qty we just applied
    await upsertPlacement(admin, itemId, from, qty, session.profileId)
    redirect(`${back}?error=${encodeURIComponent(inRes.error)}`)
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

  revalidatePath('/stock/locations')
  revalidatePath('/owner/stock/overview')
  revalidatePath('/owner/stock/alerts')
  revalidatePath('/owner')
  revalidatePath('/owner/order-pad')
  redirect(`${back}?notice=Moved+${qty}`)
}

/** Set an absolute count at a location (stock take). */
export async function adjustPlacement(formData: FormData) {
  const session = await requireSignedIn()
  const itemId = String(formData.get('stock_item_id') ?? '').trim()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const back = String(formData.get('back') ?? '/stock/locations')

  if (!itemId || !locationId || !Number.isFinite(qty) || qty < 0) {
    redirect(`${back}?error=Enter+a+quantity+of+0+or+more`)
  }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('stock_placements')
    .select('id, quantity')
    .eq('stock_item_id', itemId)
    .eq('location_id', locationId)
    .maybeSingle()
  const previous = existing ? Number(existing.quantity) : 0

  if (existing) {
    await admin
      .from('stock_placements')
      .update({ quantity: qty, updated_at: new Date().toISOString(), updated_by: session.profileId })
      .eq('id', existing.id)
  } else {
    await admin.from('stock_placements').insert({
      stock_item_id: itemId,
      location_id: locationId,
      quantity: qty,
      updated_by: session.profileId,
    })
  }

  await admin.from('stock_location_moves').insert({
    stock_item_id: itemId,
    from_location_id: null,
    to_location_id: locationId,
    quantity: qty - previous,
    kind: 'adjust',
    previous_quantity: previous,
    new_quantity: qty,
    notes,
    moved_by: session.profileId,
  })

  revalidatePath('/stock/locations')
  revalidatePath('/owner/stock/overview')
  revalidatePath('/owner/stock/alerts')
  revalidatePath('/owner')
  revalidatePath('/owner/order-pad')
  redirect(`${back}?notice=Count+set+to+${qty}`)
}

/** Add N to a location (new stock received). */
export async function receiveStock(formData: FormData) {
  const session = await requireSignedIn()
  const itemId = String(formData.get('stock_item_id') ?? '').trim()
  const locationId = String(formData.get('location_id') ?? '').trim()
  const qty = toNumber(formData.get('quantity'))
  const notes = String(formData.get('notes') ?? '').trim() || null
  const back = String(formData.get('back') ?? '/stock/locations')

  if (!itemId || !locationId || !Number.isFinite(qty) || qty <= 0) {
    redirect(`${back}?error=Enter+a+positive+quantity`)
  }

  const admin = createAdminClient()
  const res = await upsertPlacement(admin, itemId, locationId, qty, session.profileId)
  if ('error' in res) redirect(`${back}?error=${encodeURIComponent(res.error)}`)

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

  revalidatePath('/stock/locations')
  revalidatePath('/owner/stock/overview')
  revalidatePath('/owner/stock/alerts')
  revalidatePath('/owner')
  revalidatePath('/owner/order-pad')
  redirect(`${back}?notice=Received+${qty}`)
}

/** Owner: set item par level (drives alerts). */
export async function setParLevel(itemId: string, formData: FormData) {
  await requireOwner()
  const par = toNumber(formData.get('par_level'))
  const admin = createAdminClient()
  await admin
    .from('stock_items')
    .update({ par_level: Number.isFinite(par) && par >= 0 ? par : null })
    .eq('id', itemId)
  revalidatePath('/owner/stock/alerts')
  revalidatePath('/owner/stock/overview')
  revalidatePath('/owner')
  revalidatePath('/owner/order-pad')
  redirect('/owner/stock/alerts?notice=Par+updated')
}

/** Owner: create a location. */
export async function createLocation(formData: FormData) {
  await requireOwner()
  const name = String(formData.get('name') ?? '').trim()
  const zone = String(formData.get('zone') ?? 'kitchen').trim()
  const cold_type = String(formData.get('cold_type') ?? '').trim() || null
  if (!name) redirect('/owner/stock/locations?error=Name+required')

  const admin = createAdminClient()
  const { error } = await admin.from('stock_locations').insert({
    name,
    zone: ['kitchen', 'cafe', 'storage', 'other'].includes(zone) ? zone : 'other',
    cold_type,
    active: true,
  })
  if (error) {
    redirect(`/owner/stock/locations?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/stock/locations')
  revalidatePath('/stock/locations')
  redirect('/owner/stock/locations?notice=Location+added')
}

/** Owner: deactivate a location (soft-delete). */
export async function deactivateLocation(id: string) {
  await requireOwner()
  const admin = createAdminClient()
  await admin.from('stock_locations').update({ active: false }).eq('id', id)
  revalidatePath('/owner/stock/locations')
  revalidatePath('/stock/locations')
  redirect('/owner/stock/locations?notice=Location+deactivated')
}

export async function reactivateLocation(id: string) {
  await requireOwner()
  const admin = createAdminClient()
  await admin.from('stock_locations').update({ active: true }).eq('id', id)
  revalidatePath('/owner/stock/locations')
  revalidatePath('/stock/locations')
  redirect('/owner/stock/locations?notice=Location+reactivated')
}
