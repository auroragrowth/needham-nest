'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { COMMON_ALLERGENS, type RecipeLine } from './index'

async function requireOwnerOrManager() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

function readRecipe(formData: FormData): RecipeLine[] {
  const lines: RecipeLine[] = []
  for (let i = 0; i < 16; i++) {
    const itemId = String(formData.get(`recipe_${i}_item`) ?? '').trim()
    const qtyStr = String(formData.get(`recipe_${i}_qty`) ?? '').trim()
    if (!itemId || qtyStr === '') continue
    const quantity = Number(qtyStr)
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    lines.push({ stock_item_id: itemId, quantity })
  }
  return lines
}

function readAllergens(formData: FormData): string[] {
  const out: string[] = []
  for (const a of COMMON_ALLERGENS) {
    if (formData.get(`allergen_${a}`) === 'on') out.push(a)
  }
  return out
}

function parsePayload(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim() || null
  const description = String(formData.get('description') ?? '').trim() || null
  const sellStr = String(formData.get('sell_price') ?? '').trim()
  const overrideStr = String(formData.get('cost_price_override') ?? '').trim()

  return {
    name,
    category,
    description,
    sell_price: Number(sellStr || '0'),
    cost_price_override: overrideStr === '' ? null : Number(overrideStr),
    recipe: readRecipe(formData),
    allergens: readAllergens(formData),
  }
}

export async function createMenuItem(formData: FormData) {
  await requireOwnerOrManager()
  const payload = parsePayload(formData)
  if (!payload.name) {
    redirect('/owner/menu/new?error=Name+is+required')
  }
  if (!Number.isFinite(payload.sell_price) || payload.sell_price < 0) {
    redirect('/owner/menu/new?error=Sell+price+must+be+a+positive+number')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('menu_items')
    .insert({ ...payload, active: true })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/menu/new?error=${encodeURIComponent(error?.message ?? 'Failed')}`,
    )
  }
  revalidatePath('/owner/menu')
  redirect(`/owner/menu/${data.id}?notice=Item+added`)
}

export async function updateMenuItem(id: string, formData: FormData) {
  await requireOwnerOrManager()
  const payload = parsePayload(formData)
  if (!payload.name) {
    redirect(`/owner/menu/${id}?error=Name+is+required`)
  }
  const admin = createAdminClient()
  const { error } = await admin.from('menu_items').update(payload).eq('id', id)
  if (error) {
    redirect(`/owner/menu/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/menu')
  revalidatePath(`/owner/menu/${id}`)
  redirect(`/owner/menu/${id}?notice=Saved`)
}

async function setActive(id: string, active: boolean) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin
    .from('menu_items')
    .update({ active })
    .eq('id', id)
  if (error) {
    redirect(`/owner/menu/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/menu')
  revalidatePath(`/owner/menu/${id}`)
  redirect(`/owner/menu/${id}?notice=${active ? 'Reactivated' : 'Deactivated'}`)
}

export async function deactivateMenuItem(id: string) {
  await setActive(id, false)
}
export async function reactivateMenuItem(id: string) {
  await setActive(id, true)
}
