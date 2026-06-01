import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createArticle } from '@/lib/handbook/actions'
import { HandbookForm } from '../form'

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner') redirect('/handbook')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link
        href="/handbook"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Handbook
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        New article
      </h1>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <HandbookForm action={createArticle} submitLabel="Create article" />
    </main>
  )
}
