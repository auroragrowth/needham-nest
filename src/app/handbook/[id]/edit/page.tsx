import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { updateArticle } from '@/lib/handbook/actions'
import { HandbookForm } from '../../form'

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect(`/handbook/${id}`)

  const admin = createAdminClient()
  const { data: a } = await admin
    .from('handbook_articles')
    .select('id, title, category, body, sort_order')
    .eq('id', id)
    .maybeSingle()
  if (!a) notFound()

  const action = updateArticle.bind(null, id)

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link
        href={`/handbook/${id}`}
        className="text-sm text-brand-amber hover:underline"
      >
        ← Back to article
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Edit article
      </h1>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <HandbookForm action={action} defaults={a} submitLabel="Save changes" />
    </main>
  )
}
