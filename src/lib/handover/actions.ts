'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export async function addHandoverNote(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/login')
  const body = String(formData.get('body') ?? '').trim()
  if (!body) redirect('/staff/handover?error=Write+something+first')
  if (body.length > 2000) redirect('/staff/handover?error=Keep+it+under+2000+characters')

  const { error } = await createAdminClient()
    .from('handover_notes')
    .insert({ body, author_id: session.profileId })
  if (error) redirect(`/staff/handover?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/staff/handover')
  revalidatePath('/staff')
  redirect('/staff/handover?notice=Note+left+for+the+next+shift')
}
