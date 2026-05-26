'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  EXPENSE_CATEGORIES,
  TAKINGS_SOURCES,
  type ExpenseCategory,
  type TakingsSource,
} from './constants'

const VALID_CATEGORIES = EXPENSE_CATEGORIES.map((c) => c.value)
const VALID_SOURCES = TAKINGS_SOURCES.map((s) => s.value)

async function requireFinanceRole() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

/** Auto-create a payee if vendor doesn't already exist; return payee.id. */
async function ensurePayee(
  vendorName: string,
  category: ExpenseCategory,
): Promise<string> {
  const admin = createAdminClient()
  const name = vendorName.trim()
  if (!name) throw new Error('Vendor name is required')

  const { data: existing } = await admin
    .from('payees')
    .select('id')
    .ilike('name', name)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await admin
    .from('payees')
    .insert({ name, default_category: category, active: true })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error(error?.message ?? 'Failed to create payee')
  }
  return created.id
}

export async function createExpense(formData: FormData) {
  const session = await requireFinanceRole()

  const date = String(formData.get('date') ?? '').trim() || undefined
  const categoryRaw = String(formData.get('category') ?? '').trim()
  const category = VALID_CATEGORIES.includes(categoryRaw as ExpenseCategory)
    ? (categoryRaw as ExpenseCategory)
    : null
  const vendor = String(formData.get('vendor') ?? '').trim()
  const amount = Number(formData.get('amount'))
  const payment_method =
    String(formData.get('payment_method') ?? '').trim() || null
  const reference = String(formData.get('reference') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!category) redirect('/owner/expenses/new?error=Pick+a+category')
  if (!vendor) redirect('/owner/expenses/new?error=Vendor+is+required')
  if (!Number.isFinite(amount) || amount < 0) {
    redirect('/owner/expenses/new?error=Amount+must+be+a+positive+number')
  }

  let payeeId: string
  try {
    payeeId = await ensurePayee(vendor, category)
  } catch (e) {
    redirect(
      `/owner/expenses/new?error=${encodeURIComponent(
        e instanceof Error ? e.message : 'Failed to create payee',
      )}`,
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .insert({
      user_id: session.profileId,
      date,
      category,
      payee_id: payeeId,
      vendor,
      amount,
      payment_method,
      reference,
      notes,
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/expenses/new?error=${encodeURIComponent(error?.message ?? 'Failed to create expense')}`,
    )
  }

  revalidatePath('/owner/expenses')
  revalidatePath('/owner/payees')
  revalidatePath('/owner')
  redirect(`/owner/expenses/${data.id}?notice=Expense+recorded`)
}

export async function updateExpense(id: string, formData: FormData) {
  const session = await requireFinanceRole()
  void session

  const date = String(formData.get('date') ?? '').trim() || undefined
  const categoryRaw = String(formData.get('category') ?? '').trim()
  const category = VALID_CATEGORIES.includes(categoryRaw as ExpenseCategory)
    ? (categoryRaw as ExpenseCategory)
    : null
  const vendor = String(formData.get('vendor') ?? '').trim()
  const amount = Number(formData.get('amount'))
  const payment_method =
    String(formData.get('payment_method') ?? '').trim() || null
  const reference = String(formData.get('reference') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!category) redirect(`/owner/expenses/${id}?error=Pick+a+category`)
  if (!vendor) redirect(`/owner/expenses/${id}?error=Vendor+is+required`)
  if (!Number.isFinite(amount) || amount < 0) {
    redirect(`/owner/expenses/${id}?error=Amount+must+be+a+positive+number`)
  }

  let payeeId: string
  try {
    payeeId = await ensurePayee(vendor, category)
  } catch (e) {
    redirect(
      `/owner/expenses/${id}?error=${encodeURIComponent(
        e instanceof Error ? e.message : 'Failed',
      )}`,
    )
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('expenses')
    .update({
      date,
      category,
      payee_id: payeeId,
      vendor,
      amount,
      payment_method,
      reference,
      notes,
    })
    .eq('id', id)

  if (error) {
    redirect(`/owner/expenses/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner/expenses')
  revalidatePath(`/owner/expenses/${id}`)
  revalidatePath('/owner/payees')
  redirect(`/owner/expenses/${id}?notice=Saved`)
}

export async function deleteExpense(id: string) {
  await requireFinanceRole()
  const admin = createAdminClient()
  const { error } = await admin.from('expenses').delete().eq('id', id)
  if (error) {
    redirect(`/owner/expenses/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/expenses')
  redirect('/owner/expenses?notice=Expense+deleted')
}

export async function createPayee(formData: FormData) {
  await requireFinanceRole()
  const name = String(formData.get('name') ?? '').trim()
  const categoryRaw = String(formData.get('default_category') ?? '').trim()
  const default_category = VALID_CATEGORIES.includes(
    categoryRaw as ExpenseCategory,
  )
    ? (categoryRaw as ExpenseCategory)
    : null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!name) redirect('/owner/payees/new?error=Name+is+required')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payees')
    .insert({ name, default_category, notes, active: true })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/payees/new?error=${encodeURIComponent(error?.message ?? 'Failed')}`,
    )
  }
  revalidatePath('/owner/payees')
  redirect(`/owner/payees/${data.id}?notice=Payee+added`)
}

export async function updatePayee(id: string, formData: FormData) {
  await requireFinanceRole()
  const name = String(formData.get('name') ?? '').trim()
  const categoryRaw = String(formData.get('default_category') ?? '').trim()
  const default_category = VALID_CATEGORIES.includes(
    categoryRaw as ExpenseCategory,
  )
    ? (categoryRaw as ExpenseCategory)
    : null
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!name) redirect(`/owner/payees/${id}?error=Name+is+required`)

  const admin = createAdminClient()
  const { error } = await admin
    .from('payees')
    .update({ name, default_category, notes })
    .eq('id', id)
  if (error) {
    redirect(`/owner/payees/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/payees')
  revalidatePath(`/owner/payees/${id}`)
  redirect(`/owner/payees/${id}?notice=Saved`)
}

export async function createTakings(formData: FormData) {
  const session = await requireFinanceRole()
  const date = String(formData.get('date') ?? '').trim() || undefined
  const sourceRaw = String(formData.get('source') ?? '').trim()
  const source = VALID_SOURCES.includes(sourceRaw as TakingsSource)
    ? (sourceRaw as TakingsSource)
    : null
  const amount = Number(formData.get('amount'))
  const description = String(formData.get('description') ?? '').trim() || null
  const reference = String(formData.get('reference') ?? '').trim() || null

  if (!source) redirect('/owner/takings/new?error=Pick+a+source')
  if (!Number.isFinite(amount) || amount < 0) {
    redirect('/owner/takings/new?error=Amount+must+be+a+positive+number')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('takings').insert({
    user_id: session.profileId,
    date,
    source,
    amount,
    description,
    reference,
  })

  if (error) {
    redirect(`/owner/takings/new?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/takings')
  revalidatePath('/owner')
  redirect('/owner/takings?notice=Takings+recorded')
}
