'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { syncSumUp } from './sync'

async function requireOwner() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/')
  return session
}

export async function disconnectSumUp() {
  await requireOwner()
  const admin = createAdminClient()
  await admin
    .from('sumup_connections')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  revalidatePath('/owner/integrations/sumup')
  redirect('/owner/integrations/sumup?notice=Disconnected')
}

export async function manualSync(formData: FormData) {
  const session = await requireOwner()
  const daysBackStr = String(formData.get('days_back') ?? '1').trim()
  const daysBack = Math.max(1, Math.min(30, Number(daysBackStr) || 1))

  const since = new Date()
  since.setDate(since.getDate() - daysBack)

  const result = await syncSumUp({
    since,
    importedBy: session.profileId,
  })

  revalidatePath('/owner/integrations/sumup')
  revalidatePath('/owner/takings')

  redirect(
    `/owner/integrations/sumup?${
      result.ok
        ? `notice=${encodeURIComponent(result.message)}`
        : `error=${encodeURIComponent(result.message)}`
    }`,
  )
}
