import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

export default async function HandbookListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const query = admin
    .from('handbook_articles')
    .select('id, title, category, sort_order, active, updated_at')
    .order('category')
    .order('sort_order')
    .order('title')

  // Owners see drafts too; others only see active
  if (session.role !== 'owner') {
    query.eq('active', true)
  }

  const { data: articles } = await query

  const grouped = new Map<string, NonNullable<typeof articles>>()
  for (const a of articles ?? []) {
    const k = a.category ?? 'General'
    const arr = grouped.get(k) ?? []
    arr.push(a)
    grouped.set(k, arr)
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/"
            className="text-sm text-brand-amber hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
            Handbook
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Manuals, crib sheets, how-tos. Everyone can read this.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/handbook/files"
            className="rounded-lg border border-brand-sage/60 bg-white px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-sage/10"
          >
            All files →
          </Link>
          {session.role === 'owner' && (
            <Link
              href="/handbook/new"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              + Add article
            </Link>
          )}
        </div>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      {(articles?.length ?? 0) === 0 && (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          No articles yet.
          {session.role === 'owner' &&
            ' Click "Add article" to write your first one.'}
        </p>
      )}

      <div className="mt-6 space-y-6">
        {Array.from(grouped.entries()).map(([category, list]) => (
          <section key={category}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              {category}
            </h2>
            <ul className="mt-2 divide-y divide-brand-sage/30 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
              {list.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/handbook/${a.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-sage/5"
                  >
                    <div>
                      <p className="font-medium text-brand-forest">
                        {a.title}
                        {!a.active && (
                          <span className="ml-2 rounded bg-brand-amber/20 px-2 py-0.5 text-xs text-brand-forest">
                            draft
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-brand-slate">
                        Updated{' '}
                        {new Date(a.updated_at).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span className="text-brand-amber">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
