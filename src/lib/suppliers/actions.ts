'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireOwnerOrManager() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

function parseSupplier(formData: FormData) {
  const delivery_days_raw = String(formData.get('delivery_days') ?? '').trim()
  const delivery_days = delivery_days_raw
    ? delivery_days_raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null
  const minStr = String(formData.get('minimum_order') ?? '').trim()
  return {
    name: String(formData.get('name') ?? '').trim(),
    contact_name: String(formData.get('contact_name') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    account_number: String(formData.get('account_number') ?? '').trim() || null,
    payment_terms: String(formData.get('payment_terms') ?? '').trim() || null,
    delivery_days,
    minimum_order: minStr === '' ? null : Number(minStr),
    notes: String(formData.get('notes') ?? '').trim() || null,
  }
}

export async function createSupplier(formData: FormData) {
  await requireOwnerOrManager()
  const payload = parseSupplier(formData)
  if (!payload.name) {
    redirect('/owner/suppliers/new?error=Name+is+required')
  }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('suppliers')
    .insert({ ...payload, active: true })
    .select('id')
    .single()
  if (error || !data) {
    redirect(
      `/owner/suppliers/new?error=${encodeURIComponent(error?.message ?? 'Failed')}`,
    )
  }
  revalidatePath('/owner/suppliers')
  redirect(`/owner/suppliers/${data.id}?notice=Supplier+added`)
}

export async function updateSupplier(id: string, formData: FormData) {
  await requireOwnerOrManager()
  const payload = parseSupplier(formData)
  if (!payload.name) {
    redirect(`/owner/suppliers/${id}?error=Name+is+required`)
  }
  const admin = createAdminClient()
  const { error } = await admin.from('suppliers').update(payload).eq('id', id)
  if (error) {
    redirect(`/owner/suppliers/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/suppliers')
  revalidatePath(`/owner/suppliers/${id}`)
  redirect(`/owner/suppliers/${id}?notice=Saved`)
}

type DeliveryLine = {
  stock_item_id: string
  quantity: number
  unit_cost: number
}

function readDeliveryLines(formData: FormData): DeliveryLine[] {
  const lines: DeliveryLine[] = []
  for (let i = 0; i < 16; i++) {
    const itemId = String(formData.get(`item_${i}_id`) ?? '').trim()
    const qtyStr = String(formData.get(`item_${i}_qty`) ?? '').trim()
    const costStr = String(formData.get(`item_${i}_cost`) ?? '').trim()
    if (!itemId || qtyStr === '') continue
    const quantity = Number(qtyStr)
    const unit_cost = Number(costStr || '0')
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (!Number.isFinite(unit_cost) || unit_cost < 0) continue
    lines.push({ stock_item_id: itemId, quantity, unit_cost })
  }
  return lines
}

async function ensurePayeeFromSupplier(supplierName: string): Promise<string> {
  const admin = createAdminClient()
  const name = supplierName.trim()
  const { data: existing } = await admin
    .from('payees')
    .select('id')
    .ilike('name', name)
    .maybeSingle()
  if (existing) return existing.id
  const { data, error } = await admin
    .from('payees')
    .insert({ name, default_category: 'food_purchases', active: true })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create payee')
  return data.id
}

/** Record a delivery — writes stock_movements (in) + creates an expense linked
 *  to the supplier (as payee). */
export async function recordDelivery(formData: FormData) {
  const session = await requireOwnerOrManager()

  const supplier_id = String(formData.get('supplier_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim() || undefined
  const reference = String(formData.get('reference') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!supplier_id) {
    redirect('/owner/deliveries/new?error=Pick+a+supplier')
  }

  const items = readDeliveryLines(formData)
  if (items.length === 0) {
    redirect('/owner/deliveries/new?error=Add+at+least+one+line')
  }

  const admin = createAdminClient()
  const { data: supplier } = await admin
    .from('suppliers')
    .select('id, name')
    .eq('id', supplier_id)
    .maybeSingle()
  if (!supplier) {
    redirect('/owner/deliveries/new?error=Supplier+not+found')
  }

  const total = items.reduce((a, l) => a + l.quantity * l.unit_cost, 0)

  // Create the expense first so we can link it to the delivery
  const payeeId = await ensurePayeeFromSupplier(supplier.name)
  const deliveryDate = date ?? new Date().toISOString().slice(0, 10)
  const { data: expense, error: expenseError } = await admin
    .from('expenses')
    .insert({
      user_id: session.profileId,
      date: deliveryDate,
      category: 'food_purchases',
      payee_id: payeeId,
      vendor: supplier.name,
      amount: total,
      reference,
      notes: notes ?? `Delivery: ${items.length} line${items.length === 1 ? '' : 's'}`,
    })
    .select('id')
    .single()

  if (expenseError || !expense) {
    redirect(
      `/owner/deliveries/new?error=${encodeURIComponent(expenseError?.message ?? 'Failed to create expense')}`,
    )
  }

  // Insert the delivery row
  const { data: delivery, error: deliveryError } = await admin
    .from('deliveries')
    .insert({
      supplier_id: supplier.id,
      user_id: session.profileId,
      date: deliveryDate,
      items,
      total,
      reference,
      notes,
      expense_id: expense.id,
    })
    .select('id')
    .single()

  if (deliveryError || !delivery) {
    redirect(
      `/owner/deliveries/new?error=${encodeURIComponent(deliveryError?.message ?? 'Failed to record delivery')}`,
    )
  }

  // Insert stock movements (one per line, direction = 'in')
  const movements = items.map((l) => ({
    stock_item_id: l.stock_item_id,
    user_id: session.profileId,
    date: deliveryDate,
    direction: 'in' as const,
    quantity: l.quantity,
    unit_cost: l.unit_cost,
    reference: `delivery:${delivery.id}`,
    notes: `Delivery from ${supplier.name}`,
  }))
  const { error: movementsError } = await admin
    .from('stock_movements')
    .insert(movements)

  if (movementsError) {
    // Stock movements failed — but expense and delivery exist. Surface error.
    redirect(
      `/owner/deliveries/new?error=${encodeURIComponent('Delivery saved but stock movements failed: ' + movementsError.message)}`,
    )
  }

  revalidatePath('/owner/deliveries')
  revalidatePath('/owner/expenses')
  redirect(
    `/owner/deliveries?notice=Delivery+from+${encodeURIComponent(supplier.name)}+recorded+(%C2%A3${total.toFixed(2)})`,
  )
}
