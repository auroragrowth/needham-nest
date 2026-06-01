import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  deleteAttachment,
  signedAttachmentUrls,
  updateArticle,
  uploadAttachment,
} from '@/lib/handbook/actions'
import { HandbookForm } from '../../form'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
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

  const attachments = await signedAttachmentUrls(id)
  const action = updateArticle.bind(null, id)
  const uploadAction = uploadAttachment.bind(null, id)

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

      <HandbookForm action={action} defaults={a} submitLabel="Save changes" />

      <section className="mt-8 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Files
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          Upload your existing PDFs (recipe cards, machine manuals,
          supplier sheets), photos, or Word/Excel docs — up to 50 MB each.
          Staff get a short-lived download link when they open the article.
        </p>

        {attachments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {attachments.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-md border border-brand-sage/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-brand-forest">
                    {f.label ?? f.filename}
                  </p>
                  <p className="text-xs text-brand-slate">
                    {f.filename}
                    {f.size_bytes ? ` · ${formatSize(f.size_bytes)}` : ''}
                  </p>
                </div>
                {f.url && (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-amber hover:underline"
                  >
                    Preview
                  </a>
                )}
                <form action={deleteAttachment.bind(null, id, f.id)}>
                  <button
                    type="submit"
                    className="text-xs text-brand-amber hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={uploadAction} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Label (optional)
            </label>
            <input
              name="label"
              type="text"
              placeholder="e.g. Smashed avo recipe v3"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              File <span className="text-brand-amber">*</span>
            </label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,application/pdf,image/*"
              className="mt-1 w-full text-sm text-brand-forest file:mr-3 file:rounded file:border-0 file:bg-brand-forest file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-cream"
            />
            <p className="mt-1 text-xs text-brand-slate">
              PDFs and photos open in the browser. Office docs download to
              the staff member&apos;s device.
            </p>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            Upload
          </button>
        </form>
      </section>
    </main>
  )
}
