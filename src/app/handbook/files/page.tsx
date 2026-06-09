import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function HandbookFilesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: attachments } = await admin
    .from('handbook_attachments')
    .select(
      'id, filename, mime_type, size_bytes, label, storage_path, created_at, article_id, handbook_articles(id, title, category, active)',
    )
    .order('created_at', { ascending: false })

  type Attachment = NonNullable<typeof attachments>[number] & {
    handbook_articles:
      | {
          id: string
          title: string
          category: string | null
          active: boolean
        }
      | null
  }
  const list = (attachments ?? []) as Attachment[]

  // Owners see attachments on drafts too; everyone else only sees active.
  const visible = list.filter(
    (a) => session.role === 'owner' || a.handbook_articles?.active,
  )

  const signed = await Promise.all(
    visible.map(async (a) => {
      const { data } = await admin.storage
        .from('handbook-files')
        .createSignedUrl(a.storage_path, 60 * 60)
      return { ...a, url: data?.signedUrl ?? null }
    }),
  )

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/handbook" className="text-sm text-brand-amber hover:underline">
        ← Handbook
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        All uploaded files
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Every file attached to a handbook article, newest first. Tap a file to
        open it, or tap the article title to edit alongside its other files.
      </p>

      {signed.length === 0 && (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          No files uploaded yet. Open any article and use the &ldquo;Add
          file&rdquo; button to upload a PDF or image.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {signed.map((f) => (
          <li
            key={f.id}
            className="rounded-xl border border-brand-sage/40 bg-white p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <a
                href={f.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-semibold text-brand-forest hover:text-brand-amber hover:underline"
              >
                {f.label || f.filename}
              </a>
              <span className="text-xs text-brand-slate">
                {formatSize(f.size_bytes)}
                {f.size_bytes ? ' · ' : ''}
                {new Date(f.created_at).toLocaleDateString([], {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            {f.label && f.label !== f.filename && (
              <p className="mt-1 text-xs text-brand-slate">{f.filename}</p>
            )}
            <p className="mt-2 text-xs">
              <Link
                href={`/handbook/${f.article_id}`}
                className="text-brand-amber hover:underline"
              >
                {f.handbook_articles?.category &&
                  `${f.handbook_articles.category} · `}
                {f.handbook_articles?.title ?? 'Unknown article'}
                {f.handbook_articles && !f.handbook_articles.active && (
                  <span className="ml-1 rounded bg-brand-amber/20 px-1 text-[10px] text-brand-forest">
                    draft
                  </span>
                )}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}
