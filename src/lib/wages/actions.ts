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

/**
 * Sum hours worked per staff between [start, end] inclusive (date strings).
 * Uses min(clock_out, end) and max(clock_in, start) so partial shifts on the
 * boundaries are pro-rated. Open shifts (clock_out null) are clipped to now.
 */
async function aggregateHoursByStaff(
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const admin = createAdminClient()
  const startIso = new Date(start + 'T00:00:00Z').toISOString()
  // End-of-day for the inclusive end date
  const endDate = new Date(end + 'T00:00:00Z')
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  const endIso = endDate.toISOString()

  const { data: logs } = await admin
    .from('time_logs')
    .select('user_id, clock_in, clock_out, hourly_rate')
    .gte('clock_in', startIso)
    .lt('clock_in', endIso)

  const hoursByStaff = new Map<string, number>()
  const now = new Date()
  for (const l of logs ?? []) {
    const startMs = new Date(l.clock_in).getTime()
    const endMs = l.clock_out
      ? new Date(l.clock_out).getTime()
      : now.getTime()
    const ms = Math.max(0, endMs - startMs)
    const hours = ms / 3600000
    hoursByStaff.set(
      l.user_id,
      (hoursByStaff.get(l.user_id) ?? 0) + hours,
    )
  }
  return hoursByStaff
}

export async function generateWages(formData: FormData) {
  await requireOwnerOrManager()
  const periodStart = String(formData.get('period_start') ?? '').trim()
  const periodEnd = String(formData.get('period_end') ?? '').trim()

  if (!periodStart || !periodEnd) {
    redirect('/owner/wages?error=Pick+a+start+and+end+date')
  }
  if (periodEnd < periodStart) {
    redirect('/owner/wages?error=End+must+be+after+start')
  }

  const admin = createAdminClient()
  const hoursByStaff = await aggregateHoursByStaff(periodStart, periodEnd)

  if (hoursByStaff.size === 0) {
    redirect('/owner/wages?error=No+hours+logged+in+that+period')
  }

  const { data: staff } = await admin
    .from('profiles')
    .select('id, name, hourly_rate, role')
    .in('id', Array.from(hoursByStaff.keys()))

  const inserts = (staff ?? []).map((p) => {
    const hours = Number((hoursByStaff.get(p.id) ?? 0).toFixed(2))
    const rate = Number(p.hourly_rate ?? 0)
    const gross = Number((hours * rate).toFixed(2))
    return {
      staff_user_id: p.id,
      period_start: periodStart,
      period_end: periodEnd,
      hours,
      hourly_rate: rate,
      gross,
    }
  })

  if (inserts.length === 0) {
    redirect('/owner/wages?error=No+matching+staff')
  }

  const { error } = await admin.from('wage_payments').insert(inserts)
  if (error) {
    redirect(`/owner/wages?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner/wages')
  redirect(
    `/owner/wages?notice=Generated+${inserts.length}+wage+record${inserts.length === 1 ? '' : 's'}`,
  )
}

export async function markWagePaid(id: string, formData: FormData) {
  const session = await requireOwnerOrManager()
  const paidVia = String(formData.get('paid_via') ?? '').trim() || null
  const reference = String(formData.get('reference') ?? '').trim() || null
  const createExpense = formData.get('create_expense') === 'on'

  const admin = createAdminClient()
  const { data: wage } = await admin
    .from('wage_payments')
    .select('id, staff_user_id, gross, period_start, period_end, expense_id')
    .eq('id', id)
    .maybeSingle()
  if (!wage) {
    redirect('/owner/wages?error=Wage+not+found')
  }

  let expense_id = wage.expense_id

  if (createExpense && !expense_id) {
    const { data: staff } = await admin
      .from('profiles')
      .select('name')
      .eq('id', wage.staff_user_id)
      .maybeSingle()

    // Auto-payee ("Wages – {name}")
    const payeeName = `Wages – ${staff?.name ?? 'staff'}`
    const { data: existing } = await admin
      .from('payees')
      .select('id')
      .ilike('name', payeeName)
      .maybeSingle()
    let payeeId = existing?.id
    if (!payeeId) {
      const { data: created } = await admin
        .from('payees')
        .insert({ name: payeeName, default_category: 'staff', active: true })
        .select('id')
        .single()
      payeeId = created?.id
    }

    const { data: exp } = await admin
      .from('expenses')
      .insert({
        user_id: session.profileId,
        date: new Date().toISOString().slice(0, 10),
        category: 'staff',
        payee_id: payeeId,
        vendor: payeeName,
        amount: Number(wage.gross),
        payment_method: paidVia,
        reference,
        notes: `Wages for ${wage.period_start} to ${wage.period_end}`,
      })
      .select('id')
      .single()
    expense_id = exp?.id ?? null
  }

  const { error } = await admin
    .from('wage_payments')
    .update({
      paid_at: new Date().toISOString().slice(0, 10),
      paid_via: paidVia,
      reference,
      expense_id,
    })
    .eq('id', id)

  if (error) {
    redirect(`/owner/wages/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner/wages')
  revalidatePath(`/owner/wages/${id}`)
  if (createExpense) revalidatePath('/owner/expenses')
  redirect(`/owner/wages/${id}?notice=Marked+as+paid`)
}

export async function deleteWage(id: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin.from('wage_payments').delete().eq('id', id)
  if (error) {
    redirect(`/owner/wages/${id}?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/wages')
  redirect('/owner/wages?notice=Wage+deleted')
}

export async function recordTipPool(formData: FormData) {
  const session = await requireOwnerOrManager()
  const date = String(formData.get('date') ?? '').trim()
  const total = Number(formData.get('total_collected'))
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!date) {
    redirect('/owner/tips?error=Pick+a+date')
  }
  if (!Number.isFinite(total) || total <= 0) {
    redirect('/owner/tips?error=Total+must+be+greater+than+0')
  }

  const hoursByStaff = await aggregateHoursByStaff(date, date)
  if (hoursByStaff.size === 0) {
    redirect('/owner/tips?error=No+staff+worked+on+that+date')
  }

  const totalHours = Array.from(hoursByStaff.values()).reduce(
    (a, h) => a + h,
    0,
  )
  if (totalHours <= 0) {
    redirect('/owner/tips?error=Total+hours+is+zero')
  }

  const distribution = Array.from(hoursByStaff.entries()).map(
    ([user_id, hours]) => ({
      user_id,
      hours: Number(hours.toFixed(2)),
      amount: Number(((hours / totalHours) * total).toFixed(2)),
    }),
  )

  const admin = createAdminClient()
  const { error } = await admin.from('tip_pools').insert({
    date,
    total_collected: total,
    distribution,
    notes,
    created_by: session.profileId,
  })

  if (error) {
    redirect(`/owner/tips?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/tips')
  redirect('/owner/tips?notice=Tip+pool+recorded')
}

export async function deleteTipPool(id: string) {
  await requireOwnerOrManager()
  const admin = createAdminClient()
  const { error } = await admin.from('tip_pools').delete().eq('id', id)
  if (error) {
    redirect(`/owner/tips?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/owner/tips')
  redirect('/owner/tips?notice=Tip+pool+removed')
}
