'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { payeeKey } from './receipts-to-find'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

/** This one payment will never have a receipt: take it off Receipts to find. */
export async function markNoReceipt(bankTransactionId: string): Promise<void> {
  const session = await requireOwner()
  await createAdminClient()
    .from('bank_transactions')
    .update({
      no_receipt_reason: 'no receipt needed',
      no_receipt_by: session.name,
      no_receipt_at: new Date().toISOString(),
    })
    .eq('id', bankTransactionId)
    .is('matched_expense_id', null)
  revalidatePath('/owner/receipts-to-find')
}

/** Nothing paid to this payee ever needs a receipt (wages under another name, a transfer…). */
export async function neverNeedsReceipt(payee: string): Promise<void> {
  const session = await requireOwner()
  const key = payeeKey(payee)
  if (key) {
    await createAdminClient()
      .from('bank_payee_rules')
      .upsert(
        { payee: key, reason: 'no receipt needed', created_by: session.name },
        { onConflict: 'payee', ignoreDuplicates: true },
      )
  }
  revalidatePath('/owner/receipts-to-find')
}
