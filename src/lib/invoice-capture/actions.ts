'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { readWaiting } from './read'

/** The owner's "read them now" button on Invoice reconciliation. */
export async function readWaitingNow(): Promise<void> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')

  const params = new URLSearchParams()
  try {
    const s = await readWaiting()
    params.set(
      'notice',
      s.read + s.failed + s.skipped === 0
        ? 'Nothing waiting to be read.'
        : `Read ${s.read} waiting ${s.read === 1 ? 'invoice' : 'invoices'}${
            s.failed ? `, ${s.failed} could not be read` : ''
          }${s.skipped ? `, ${s.skipped} already being read` : ''}.`,
    )
    if (s.errors.length) params.set('errors', s.errors.slice(0, 5).join(' | '))
  } catch (e) {
    params.set('errors', e instanceof Error ? e.message : 'Could not reach the till.')
  }
  revalidatePath('/owner/invoices-reconcile')
  redirect(`/owner/invoices-reconcile?${params.toString()}`)
}
