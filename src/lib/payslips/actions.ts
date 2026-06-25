'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireOwner() {
  // Owner or payroll can generate / mark paid / delete. Payroll users
  // come from /payroll/* and need the same write access on the slip.
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'payroll') redirect('/')
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

  // ISO week number of the period's end date — e.g. period ending Sun
  // 22 Jun 2026 → 2026-W25. Stable identifier we can print on the slip
  // and reference verbally ('week 25').
  const periodEnd = new Date(period_to + 'T00:00:00Z')
  const slip_number = isoWeekIdentifier(periodEnd)

  const payload = {
    staff_id: staffId,
    period_from,
    period_to,
    pay_date,
    hours_worked,
    gross_pay,
    slip_number,
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
  const isPayroll = session.role === 'payroll'
  if (error || !data) {
    const dest = isPayroll
      ? `/payroll/payslips/generate?staff=${staffId}`
      : `/owner/payslips/${staffId}/generate`
    redirect(
      `${dest}?error=${encodeURIComponent(error?.message ?? 'Save failed')}`,
    )
  }

  revalidatePath(`/owner/payslips/${staffId}`)
  revalidatePath(`/owner/payslips/${staffId}/generate`)
  revalidatePath('/payroll/payslips')
  redirect(
    isPayroll
      ? `/payroll/payslips/${data.id}`
      : `/owner/payslips/${staffId}/${data.id}`,
  )
}

export async function deletePayslip(staffId: string, payslipId: string) {
  await requireOwner()
  const admin = createAdminClient()
  await admin.from('payslips').delete().eq('id', payslipId)
  revalidatePath(`/owner/payslips/${staffId}`)
  redirect(`/owner/payslips/${staffId}?notice=Payslip+deleted`)
}

export async function markPayslipPaid(
  staffId: string,
  payslipId: string,
  formData: FormData,
) {
  const session = await requireOwner()
  const method = String(formData.get('paid_method') ?? '').trim() || 'BACS'
  const admin = createAdminClient()
  await admin
    .from('payslips')
    .update({
      paid_at: new Date().toISOString(),
      paid_method: method,
      paid_by: session.profileId,
    })
    .eq('id', payslipId)
  revalidatePath(`/owner/payslips/${staffId}`)
  revalidatePath(`/owner/payslips/${staffId}/${payslipId}`)
  revalidatePath('/staff/me/payslips')
  redirect(`/owner/payslips/${staffId}/${payslipId}?notice=Marked+paid`)
}

export async function unmarkPayslipPaid(
  staffId: string,
  payslipId: string,
) {
  await requireOwner()
  const admin = createAdminClient()
  await admin
    .from('payslips')
    .update({ paid_at: null, paid_method: null, paid_by: null })
    .eq('id', payslipId)
  revalidatePath(`/owner/payslips/${staffId}`)
  revalidatePath(`/owner/payslips/${staffId}/${payslipId}`)
  revalidatePath('/staff/me/payslips')
  redirect(
    `/owner/payslips/${staffId}/${payslipId}?notice=Marked+unpaid`,
  )
}

/** Returns the ISO-8601 week identifier for a date (e.g. '2026-W25'). */
function isoWeekIdentifier(d: Date): string {
  // Algorithm: shift to Thursday of the same ISO week, then count
  // weeks from the first Thursday of the ISO year.
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  const dayNum = (target.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3) // Thursday of ISO week
  const firstThursday = new Date(
    Date.UTC(target.getUTCFullYear(), 0, 4),
  )
  const firstThuDow = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThuDow + 3)
  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    )
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
