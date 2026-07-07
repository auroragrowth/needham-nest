'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireOwnerOrPayroll() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'payroll') redirect('/')
  return session
}

function n(fd: FormData, key: string): number {
  const raw = String(fd.get(key) ?? '').trim()
  if (!raw) return 0
  const v = Number(raw)
  return Number.isFinite(v) ? v : 0
}
function s(fd: FormData, key: string): string | null {
  const raw = String(fd.get(key) ?? '').trim()
  return raw === '' ? null : raw
}

export async function savePayrollRun(formData: FormData) {
  const session = await requireOwnerOrPayroll()
  const admin = createAdminClient()

  const run_type = String(formData.get('run_type') ?? '').trim()
  const period_label = String(formData.get('period_label') ?? '').trim()
  const pay_date = String(formData.get('pay_date') ?? '').trim()
  if (
    (run_type !== 'weekly' && run_type !== 'monthly') ||
    !period_label ||
    !pay_date
  ) {
    redirect('/owner/payroll-runs/new?error=Fill+in+type%2C+period+and+pay+date')
  }

  const payload = {
    run_type,
    period_label,
    pay_date,
    headcount: Math.max(0, Math.floor(n(formData, 'headcount'))),
    total_gross: n(formData, 'total_gross'),
    tax_deducted: n(formData, 'tax_deducted'),
    employee_nic: n(formData, 'employee_nic'),
    employer_nic: n(formData, 'employer_nic'),
    total_net: n(formData, 'total_net'),
    hmrc_due: n(formData, 'hmrc_due'),
    total_outlay: n(formData, 'total_outlay'),
    status: (s(formData, 'status') ?? 'draft') as 'draft' | 'filed' | 'paid',
    notes: s(formData, 'notes'),
    created_by: session.profileId,
  }

  const { data, error } = await admin
    .from('payroll_runs')
    .upsert(payload, { onConflict: 'run_type,period_label' })
    .select('id')
    .single()

  if (error || !data) {
    redirect(
      `/owner/payroll-runs/new?error=${encodeURIComponent(error?.message ?? 'Save failed')}`,
    )
  }

  // Optional PDF attachment
  const file = formData.get('pdf')
  if (file instanceof File && file.size > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const storagePath = `${data.id}/${crypto.randomUUID()}.${ext}`
    const bytes = await file.arrayBuffer()
    const { error: upErr } = await admin.storage
      .from('payroll-runs')
      .upload(storagePath, bytes, { contentType: file.type })
    if (!upErr) {
      await admin
        .from('payroll_runs')
        .update({ pdf_path: storagePath })
        .eq('id', data.id)
    }
  }

  revalidatePath('/owner/payroll-runs')
  revalidatePath('/payroll/runs')
  redirect(`/owner/payroll-runs/${data.id}?notice=Saved`)
}

export async function markRunStatus(id: string, status: string) {
  await requireOwnerOrPayroll()
  if (status !== 'draft' && status !== 'filed' && status !== 'paid') return
  const admin = createAdminClient()
  await admin.from('payroll_runs').update({ status }).eq('id', id)
  revalidatePath('/owner/payroll-runs')
  revalidatePath(`/owner/payroll-runs/${id}`)
  revalidatePath('/payroll/runs')
}

export async function deletePayrollRun(id: string) {
  await requireOwnerOrPayroll()
  const admin = createAdminClient()
  const { data } = await admin
    .from('payroll_runs')
    .select('pdf_path')
    .eq('id', id)
    .maybeSingle()
  if (data?.pdf_path) {
    await admin.storage.from('payroll-runs').remove([data.pdf_path])
  }
  await admin.from('payroll_runs').delete().eq('id', id)
  revalidatePath('/owner/payroll-runs')
  redirect('/owner/payroll-runs?notice=Deleted')
}
