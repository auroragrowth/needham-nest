'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { getMySignoff, londonToday, SIGNOFF_PATH } from '@/lib/handbook/signoff'

function back(kind: 'notice' | 'error', msg: string): never {
  redirect(`${SIGNOFF_PATH}?${kind}=${encodeURIComponent(msg)}`)
}

async function mine() {
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(SIGNOFF_PATH)}`)
  const signoff = await getMySignoff(session.profileId)
  if (!signoff) back('error', "You don't have a handbook sign-off to do.")
  return { session, signoff }
}

/** Step 1: "I have read it". Only once every article has been opened. */
export async function confirmHandbookRead() {
  const { signoff } = await mine()
  if (signoff.row.signed_at) back('notice', 'Already signed. Thank you.')
  const unread = signoff.articles.filter((a) => !signoff.readIds.has(a.id))
  if (unread.length > 0) {
    back('error', `Open the ${unread.length} section${unread.length === 1 ? '' : 's'} still to read first.`)
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('handbook_signoffs')
    .update({ read_confirmed_at: new Date().toISOString() })
    .eq('id', signoff.row.id)
    .is('signed_at', null)
  if (error) back('error', error.message)
  revalidatePath(SIGNOFF_PATH)
  back('notice', 'Thanks. Now sign and date below.')
}

/** Step 2: sign and date. */
export async function signHandbook(formData: FormData) {
  const { signoff } = await mine()
  if (signoff.row.signed_at) back('notice', 'Already signed. Thank you.')
  if (!signoff.row.read_confirmed_at) back('error', 'Tap "I have read it" first.')

  const signedName = String(formData.get('signed_name') ?? '').trim()
  const signedOn = String(formData.get('signed_on') ?? '').trim()
  const signature = String(formData.get('signature_data') ?? '')

  if (signedName.length < 3) back('error', 'Type your full name.')
  if (signedOn !== londonToday()) back('error', "The date must be today's date.")
  if (!signature.startsWith('data:image/png;base64,') || signature.length < 1500) {
    back('error', 'Draw your signature in the box.')
  }
  if (signature.length > 400_000) back('error', 'That signature is too large. Clear it and sign again.')

  const h = await headers()
  const admin = createAdminClient()
  const { error } = await admin
    .from('handbook_signoffs')
    .update({
      signed_name: signedName,
      signed_on: signedOn,
      signature_data: signature,
      signed_at: new Date().toISOString(),
      user_agent: h.get('user-agent')?.slice(0, 400) ?? null,
    })
    .eq('id', signoff.row.id)
    .is('signed_at', null)
  if (error) back('error', error.message)
  revalidatePath(SIGNOFF_PATH)
  revalidatePath('/staff')
  revalidatePath('/manager')
  revalidatePath('/owner/handbook-signoffs')
  back('notice', 'Signed. Thank you, that’s all done.')
}
