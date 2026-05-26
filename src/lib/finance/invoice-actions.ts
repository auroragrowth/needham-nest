'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireFinanceRole() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

export async function createCustomer(formData: FormData) {
  await requireFinanceRole()
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim() || null
  const address = String(formData.get('address') ?? '').trim() || null
  const city = String(formData.get('city') ?? '').trim() || null
  const postcode = String(formData.get('postcode') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!name) redirect('/owner/customers/new?error=Name+is+required')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customers')
    .insert({ name, email, address, city, postcode, notes, active: true })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/customers/new?error=${encodeURIComponent(error?.message ?? 'Failed')}`,
    )
  }

  revalidatePath('/owner/customers')
  redirect(`/owner/invoices/new?customer=${data.id}&notice=Customer+added`)
}

type InvoiceItem = {
  description: string
  quantity: number
  unit_price: number
}

function readItems(formData: FormData): InvoiceItem[] {
  const items: InvoiceItem[] = []
  for (let i = 0; i < 20; i++) {
    const description = String(formData.get(`item_${i}_description`) ?? '').trim()
    const qtyStr = String(formData.get(`item_${i}_quantity`) ?? '').trim()
    const priceStr = String(formData.get(`item_${i}_price`) ?? '').trim()
    if (!description && !qtyStr && !priceStr) continue
    const quantity = Number(qtyStr || '0')
    const unit_price = Number(priceStr || '0')
    if (!description) continue
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (!Number.isFinite(unit_price) || unit_price < 0) continue
    items.push({ description, quantity, unit_price })
  }
  return items
}

async function nextInvoiceNumber(): Promise<string> {
  const admin = createAdminClient()
  const { data: settingsRows } = await admin
    .from('settings')
    .select('user_id, invoice_prefix, invoice_next_number')
    .order('updated_at', { ascending: false })
    .limit(1)
  const row = settingsRows?.[0]

  if (!row) {
    return `INV-${Date.now()}`
  }
  const prefix = row.invoice_prefix ?? 'INV-'
  const num = Number(row.invoice_next_number ?? 1)
  const padded = String(num).padStart(4, '0')

  // Bump next number
  await admin
    .from('settings')
    .update({ invoice_next_number: num + 1 })
    .eq('user_id', row.user_id)

  return `${prefix}${padded}`
}

export async function createInvoice(formData: FormData) {
  const session = await requireFinanceRole()

  const customerId =
    String(formData.get('customer_id') ?? '').trim() || null
  const date = String(formData.get('date') ?? '').trim() || undefined
  const dueDate = String(formData.get('due_date') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!customerId) {
    redirect('/owner/invoices/new?error=Pick+a+customer')
  }

  const items = readItems(formData)
  if (items.length === 0) {
    redirect('/owner/invoices/new?error=Add+at+least+one+line+item')
  }

  const admin = createAdminClient()
  const { data: customer } = await admin
    .from('customers')
    .select('id, name, email, address, city, postcode')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) {
    redirect('/owner/invoices/new?error=Customer+not+found')
  }

  const subtotal = items.reduce((a, i) => a + i.quantity * i.unit_price, 0)
  const vat_amount = 0
  const total = subtotal + vat_amount

  const invoice_number = await nextInvoiceNumber()

  const { data, error } = await admin
    .from('invoices')
    .insert({
      user_id: session.profileId,
      invoice_number,
      customer_id: customer.id,
      customer_snapshot: {
        name: customer.name,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        postcode: customer.postcode,
      },
      date,
      due_date: dueDate,
      items,
      subtotal,
      vat_amount,
      total,
      status: 'draft',
      notes,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/invoices/new?error=${encodeURIComponent(error?.message ?? 'Failed to create invoice')}`,
    )
  }

  revalidatePath('/owner/invoices')
  redirect(`/owner/invoices/${data.id}?notice=Invoice+drafted`)
}

export async function markInvoiceStatus(
  id: string,
  status: 'draft' | 'sent' | 'paid' | 'overdue',
) {
  await requireFinanceRole()
  const admin = createAdminClient()
  const update: { status: typeof status; paid_at?: string | null } = {
    status,
  }
  if (status === 'paid') update.paid_at = new Date().toISOString()
  else if (status === 'draft' || status === 'sent') update.paid_at = null

  const { error } = await admin.from('invoices').update(update).eq('id', id)
  if (error) {
    redirect(`/owner/invoices/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/invoices')
  revalidatePath(`/owner/invoices/${id}`)
  redirect(`/owner/invoices/${id}?notice=Marked+as+${status}`)
}
