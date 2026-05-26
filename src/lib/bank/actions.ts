'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { parseMonzoCsv } from './csv'

async function requireFinanceRole() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')
  return session
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function importMonzoCsv(formData: FormData) {
  const session = await requireFinanceRole()

  const file = formData.get('csv')
  if (!(file instanceof File) || file.size === 0) {
    redirect('/owner/bank/upload?error=Pick+a+CSV+file')
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    redirect('/owner/bank/upload?error=Could+not+read+file')
  }

  const rows = parseMonzoCsv(text)
  if (rows.length === 0) {
    redirect('/owner/bank/upload?error=No+transactions+found+in+CSV')
  }

  const admin = createAdminClient()

  // Pull existing expenses + takings within the date range for matching
  const minDate = rows.reduce(
    (m, r) => (r.date < m ? r.date : m),
    rows[0].date,
  )
  const maxDate = rows.reduce(
    (m, r) => (r.date > m ? r.date : m),
    rows[0].date,
  )
  const windowStart = addDays(minDate, -3)
  const windowEnd = addDays(maxDate, 3)

  const [{ data: expenses }, { data: takings }] = await Promise.all([
    admin
      .from('expenses')
      .select('id, date, amount')
      .gte('date', windowStart)
      .lte('date', windowEnd),
    admin
      .from('takings')
      .select('id, date, amount')
      .gte('date', windowStart)
      .lte('date', windowEnd),
  ])

  function findExpenseMatch(date: string, absAmount: number): string | null {
    const target = (expenses ?? []).find(
      (e) =>
        Number(e.amount) === absAmount &&
        Math.abs(
          new Date(e.date).getTime() - new Date(date).getTime(),
        ) <=
          2 * 24 * 60 * 60 * 1000,
    )
    return target?.id ?? null
  }
  function findTakingsMatch(date: string, absAmount: number): string | null {
    const target = (takings ?? []).find(
      (t) =>
        Number(t.amount) === absAmount &&
        Math.abs(
          new Date(t.date).getTime() - new Date(date).getTime(),
        ) <=
          2 * 24 * 60 * 60 * 1000,
    )
    return target?.id ?? null
  }

  const inserts = rows.map((r) => {
    const absAmount = Math.abs(r.amount)
    const matchedExpense =
      r.amount < 0 ? findExpenseMatch(r.date, absAmount) : null
    const matchedTakings =
      r.amount > 0 ? findTakingsMatch(r.date, absAmount) : null
    return {
      user_id: session.profileId,
      source: 'monzo',
      transaction_id: r.transaction_id ?? `monzo_${r.date}_${r.amount}_${r.description.slice(0, 20)}`,
      date: r.date,
      description: r.description,
      amount: r.amount,
      raw_row: r.raw,
      matched_expense_id: matchedExpense,
      matched_takings_id: matchedTakings,
    }
  })

  // upsert on (source, transaction_id) so re-uploading the same CSV is safe
  const { error } = await admin
    .from('bank_transactions')
    .upsert(inserts, { onConflict: 'source,transaction_id', ignoreDuplicates: true })

  if (error) {
    redirect(`/owner/bank/upload?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/owner/bank')
  redirect(
    `/owner/bank?notice=Imported+${rows.length}+transaction${rows.length === 1 ? '' : 's'}`,
  )
}
