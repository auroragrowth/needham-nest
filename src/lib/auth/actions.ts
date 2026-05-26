'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    options: {
      data: { name: String(formData.get('name') ?? '') },
    },
  })
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }
  revalidatePath('/', 'layout')
  // If Supabase has email confirmation enabled, user must verify before signing in.
  redirect('/login?notice=Account+created.+Check+your+email+if+confirmation+is+required.')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
