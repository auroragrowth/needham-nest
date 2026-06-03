import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { TRAINING_TYPES } from '@/lib/training/constants'
import {
  addTrainingFromAdmin,
  deleteTrainingFromAdmin,
  removeTrainingFile,
  signedTrainingUrl,
  uploadTrainingFile,
} from '@/lib/training/actions'

type TrainingRow = {
  id: string
  user_id: string
  type: string
  certificate_ref: string | null
  issued_at: string | null
  expires_at: string | null
  notes: string | null
  document_path: string | null
}

function expiryStatus(expires_at: string | null) {
  if (!expires_at) return { label: '—', tone: 'plain' as const }
  const now = new Date()
  const exp = new Date(expires_at)
  if (exp < now) return { label: 'EXPIRED', tone: 'bad' as const }
  if (exp.getTime() - now.getTime() < 60 * 24 * 60 * 60 * 1000) {
    return { label: 'soon', tone: 'warn' as const }
  }
  return { label: 'valid', tone: 'good' as const }
}

export default async function TrainingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')

  const admin = createAdminClient()
  const [{ data: records }, { data: people }] = await Promise.all([
    admin
      .from('training_records')
      .select(
        'id, user_id, type, certificate_ref, issued_at, expires_at, notes, document_path',
      )
      .order('expires_at', { ascending: true, nullsFirst: false }),
    admin
      .from('profiles')
      .select('id, name, role')
      .eq('active', true)
      .neq('role', 'owner')
      .order('name'),
  ])

  const nameById = new Map((people ?? []).map((p) => [p.id, p.name]))

  // Group by training type
  const groups = new Map<string, TrainingRow[]>()
  for (const t of TRAINING_TYPES) groups.set(t.value, [])
  for (const r of ((records ?? []) as TrainingRow[])) {
    const bucket = groups.get(r.type) ?? []
    bucket.push(r)
    groups.set(r.type, bucket)
  }

  // Pre-fetch signed URLs for any record with a file (1-hour signed URLs)
  const urlByRecord = new Map<string, string | null>()
  for (const r of (records ?? []) as TrainingRow[]) {
    if (r.document_path) {
      urlByRecord.set(r.id, await signedTrainingUrl(r.id))
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-4xl p-6">
      <Link
        href="/"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Training
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Training records grouped by course. Attach a PDF of each certificate
        or sign-off sheet — staff can&apos;t see them, but the EHO pack picks
        them up.
      </p>

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

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Add training record
        </h2>
        <form action={addTrainingFromAdmin} className="mt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Staff member
            </label>
            <select
              name="staff_user_id"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            >
              <option value="" disabled>
                Pick a person
              </option>
              {(people ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.role === 'manager' ? ' (manager)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Course
            </label>
            <select
              name="type"
              defaultValue="food_hygiene_l2"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            >
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Certificate ref
            </label>
            <input
              name="certificate_ref"
              type="text"
              placeholder="e.g. RSPH-12345"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Issued
            </label>
            <input
              name="issued_at"
              type="date"
              defaultValue={today}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Expires
            </label>
            <input
              name="expires_at"
              type="date"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Notes
            </label>
            <input
              name="notes"
              type="text"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Add training record
            </button>
            <p className="mt-2 text-xs text-brand-slate">
              Upload the certificate file using the controls on the saved
              record below.
            </p>
          </div>
        </form>
      </section>

      <div className="mt-8 space-y-8">
        {TRAINING_TYPES.map((t) => {
          const list = groups.get(t.value) ?? []
          return (
            <section key={t.value}>
              <h2 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                {t.label}
                <span className="text-brand-slate">({list.length})</span>
              </h2>
              {list.length === 0 ? (
                <p className="mt-2 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
                  No records.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {list.map((r) => {
                    const status = expiryStatus(r.expires_at)
                    const url = urlByRecord.get(r.id)
                    return (
                      <li
                        key={r.id}
                        className={`rounded-xl border bg-white p-4 ${
                          status.tone === 'bad'
                            ? 'border-brand-amber/60'
                            : status.tone === 'warn'
                              ? 'border-brand-amber/40'
                              : 'border-brand-sage/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-brand-forest">
                              {nameById.get(r.user_id) ?? 'Unknown'}
                              {r.certificate_ref && (
                                <span className="ml-2 text-xs text-brand-slate">
                                  · cert {r.certificate_ref}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-brand-slate">
                              {r.issued_at && <>Issued {r.issued_at}</>}
                              {r.expires_at && (
                                <>
                                  {' · '}Expires{' '}
                                  <span
                                    className={
                                      status.tone === 'bad'
                                        ? 'text-brand-amber'
                                        : status.tone === 'warn'
                                          ? 'text-brand-amber'
                                          : 'text-brand-teal-deep'
                                    }
                                  >
                                    {r.expires_at} ({status.label})
                                  </span>
                                </>
                              )}
                            </p>
                            {r.notes && (
                              <p className="mt-1 text-xs text-brand-slate">
                                {r.notes}
                              </p>
                            )}
                          </div>
                          <form
                            action={deleteTrainingFromAdmin.bind(null, r.id)}
                          >
                            <button
                              type="submit"
                              className="text-xs text-brand-amber hover:underline"
                            >
                              Remove
                            </button>
                          </form>
                        </div>

                        <div className="mt-3 border-t border-brand-sage/30 pt-3">
                          {r.document_path ? (
                            <div className="flex items-center justify-between gap-3">
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-brand-amber hover:underline"
                                >
                                  ↓ Open certificate
                                </a>
                              ) : (
                                <span className="text-sm text-brand-slate">
                                  File attached (link error)
                                </span>
                              )}
                              <form action={removeTrainingFile.bind(null, r.id)}>
                                <button
                                  type="submit"
                                  className="text-xs text-brand-amber hover:underline"
                                >
                                  Remove file
                                </button>
                              </form>
                            </div>
                          ) : (
                            <form
                              action={uploadTrainingFile.bind(null, r.id)}
                              className="flex flex-wrap items-end gap-2"
                            >
                              <input
                                name="file"
                                type="file"
                                required
                                accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf"
                                className="text-xs text-brand-forest file:mr-2 file:rounded file:border-0 file:bg-brand-forest file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-cream"
                              />
                              <button
                                type="submit"
                                className="rounded-md bg-brand-forest px-3 py-1.5 text-xs font-medium text-brand-cream hover:bg-brand-olive"
                              >
                                Attach
                              </button>
                            </form>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}
