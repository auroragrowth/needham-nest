'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

function n(formData: FormData, key: string): number {
  const raw = String(formData.get(key) ?? '').trim()
  if (raw === '') return 0
  const v = Number(raw)
  return Number.isFinite(v) ? v : 0
}

function s(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? '').trim()
  return raw === '' ? null : raw
}

export async function savePayslip(staffId: string, formData: FormData) {
  const session = await requireOwner()
  const admin = createAdminClient()

  const period_from = String(formData.get('period_from') ?? '').trim()
  const period_to = String(formData.get('period_to') ?? '').trim()
  const pay_date = String(formData.get('pay_date') ?? '').trim()
  if (!period_from || !period_to || !pay_date) {
    redirect(
      `/owner/payslips/${staffId}/generate?error=Pick+period+from%2Fto+and+pay+date`,
    )
  }

  const hours_worked = n(formData, 'hours_worked')
  const gross_pay = n(formData, 'gross_pay')
  const tax_deduction = n(formData, 'tax_deduction')
  const ni_deduction = n(formData, 'ni_deduction')
  const pension_deduction = n(formData, 'pension_deduction')
  const other_deductions = n(formData, 'other_deductions')
  const net_pay =
    gross_pay -
    tax_deduction -
    ni_deduction -
    pension_deduction -
    other_deductions

  const payload = {
    staff_id: staffId,
    period_from,
    period_to,
    pay_date,
    hours_worked,
    gross_pay,
    tax_code: s(formData, 'tax_code'),
    ni_category: s(formData, 'ni_category') ?? 'A',
    tax_deduction,
    ni_deduction,
    pension_deduction,
    other_deductions,
    other_deductions_label: s(formData, 'other_deductions_label'),
    net_pay: Number(net_pay.toFixed(2)),
    notes: s(formData, 'notes'),
    created_by: session.profileId,
  }

  // Upsert by (staff_id, period_from, period_to)
  const { data, error } = await admin
    .from('payslips')
    .upsert(payload, { onConflict: 'staff_id,period_from,period_to' })
    .select('id')
    .single()
  if (error || !data) {
    redirect(
      `/owner/payslips/${staffId}/generate?error=${encodeURIComponent(error?.message ?? 'Save failed')}`,
    )
  }

  revalidatePath(`/owner/payslips/${staffId}`)
  revalidatePath(`/owner/payslips/${staffId}/generate`)
  redirect(`/owner/payslips/${staffId}/${data.id}`)
}

export async function deletePayslip(staffId: string, payslipId: string) {
  await requireOwner()
  const admin = createAdminClient()
  await admin.from('payslips').delete().eq('id', payslipId)
  revalidatePath(`/owner/payslips/${staffId}`)
  redirect(`/owner/payslips/${staffId}?notice=Payslip+deleted`)
}
