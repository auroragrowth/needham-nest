'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function addShoppingItem(formData: FormData) {
  const session = await requireSession()
  const item = String(formData.get('item') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null

  if (!item) {
    redirect('/shopping-list?error=Type+something+to+add')
  }

  const admin = createAdminClient()
  const { error } = await admin.from('shopping_list').insert({
    item,
    notes,
    added_by: session.profileId,
  })
  if (error) {
    redirect(`/shopping-list?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/shopping-list')
  redirect('/shopping-list?notice=Added')
}

export async function toggleShoppingItem(id: string, done: boolean) {
  const session = await requireSession()
  const admin = createAdminClient()
  const { error } = await admin
    .from('shopping_list')
    .update({
      done,
      done_by: done ? session.profileId : null,
      done_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (error) {
    redirect(`/shopping-list?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/shopping-list')
  redirect('/shopping-list')
}

export async function deleteShoppingItem(id: string) {
  await requireSession()
  const admin = createAdminClient()
  const { error } = await admin.from('shopping_list').delete().eq('id', id)
  if (error) {
    redirect(`/shopping-list?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/shopping-list')
  redirect('/shopping-list?notice=Removed')
}

export async function clearDoneShoppingItems() {
  await requireSession()
  const admin = createAdminClient()
  const { error } = await admin
    .from('shopping_list')
    .delete()
    .eq('done', true)
  if (error) {
    redirect(`/shopping-list?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/shopping-list')
  redirect('/shopping-list?notice=Done+items+cleared')
}
