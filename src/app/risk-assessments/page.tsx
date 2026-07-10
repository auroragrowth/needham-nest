import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  addRiskAssessment,
  deleteRiskAssessment,
} from '@/lib/compliance/actions'

export default async function RiskAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')
  const canEdit = session.role === 'owner'
  const backHref = canEdit ? '/owner' : '/staff'
  const backLabel = canEdit ? 'Dashboard' : 'Staff home'

  const params = await searchParams
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('risk_assessments')
    .select('id, title, reviewed_at, next_review_at, notes')
    .order('next_review_at', { ascending: true, nullsFirst: false })

  const today = new Date()

  return (
    <main className="mx-auto max-w-3xl">
      <Link href={backHref} className="text-sm text-brand-amber hover:underline">
        ← {backLabel}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Risk assessments
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Fire, manual handling, slips/trips, COSHH, etc. Review dates surface
        in the EHO pack.
        {!canEdit && ' Read-only for staff — see an owner if anything looks wrong.'}
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

      {canEdit && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Add assessment
          </h2>
          <form action={addRiskAssessment} className="mt-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-brand-forest">
                Title
              </label>
              <input
                name="title"
                required
                placeholder="e.g. Fire risk assessment"
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-forest">
                Reviewed
              </label>
              <input
                name="reviewed_at"
                type="date"
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand-forest">
                Next review
              </label>
              <input
                name="next_review_at"
                type="date"
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-brand-forest">
                Notes
              </label>
              <textarea
                name="notes"
                rows={2}
                className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
              >
                Add assessment
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Reviewed</th>
              <th className="px-4 py-3">Next review</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const next = r.next_review_at ? new Date(r.next_review_at) : null
              const overdue = next ? next < today : false
              return (
                <tr key={r.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 font-medium text-brand-forest">
                    {r.title}
                    {r.notes && (
                      <p className="text-xs text-brand-slate">{r.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-slate">
                    {r.reviewed_at
                      ? new Date(r.reviewed_at).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td
                    className={`px-4 py-3 text-xs ${overdue ? 'text-brand-amber' : 'text-brand-forest'}`}
                  >
                    {r.next_review_at
                      ? new Date(r.next_review_at).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                    {overdue && ' (overdue)'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <form action={deleteRiskAssessment.bind(null, r.id)}>
                        <button
                          type="submit"
                          className="text-xs text-brand-amber hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No assessments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
