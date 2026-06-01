import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  deleteArticle,
  hideArticle,
  publishArticle,
} from '@/lib/handbook/actions'

export default async function HandbookArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: a } = await admin
    .from('handbook_articles')
    .select('id, title, category, body, active, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (!a) notFound()
  if (!a.active && session.role !== 'owner') notFound()

  const isOwner = session.role === 'owner'

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link
        href="/handbook"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Handbook
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {a.title}
        {!a.active && (
          <span className="ml-2 rounded bg-brand-amber/20 px-2 py-0.5 align-middle text-sm font-normal text-brand-forest">
            draft — only you can see this
          </span>
        )}
      </h1>
      {a.category && (
        <p className="mt-1 text-xs uppercase tracking-wide text-brand-teal-deep">
          {a.category}
        </p>
      )}
      <p className="mt-1 text-xs text-brand-slate">
        Updated{' '}
        {new Date(a.updated_at).toLocaleString([], {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <article className="mt-6 whitespace-pre-wrap rounded-xl border border-brand-sage/40 bg-white p-6 text-brand-forest">
        {a.body || (
          <span className="text-brand-slate">No content yet.</span>
        )}
      </article>

      {isOwner && (
        <section className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/handbook/${id}/edit`}
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Edit
          </Link>
          <form
            action={a.active ? hideArticle.bind(null, id) : publishArticle.bind(null, id)}
          >
            <button
              type="submit"
              className="rounded-lg border border-brand-sage/60 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
            >
              {a.active ? 'Hide (set to draft)' : 'Publish to staff'}
            </button>
          </form>
          <form action={deleteArticle.bind(null, id)}>
            <button
              type="submit"
              className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
            >
              Delete
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
