import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

const KIND_LABEL: Record<string, string> = {
  holiday: 'Holiday',
  sick: 'Sick',
  unpaid: 'Unpaid',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-brand-amber/30 text-brand-forest',
  approved: 'bg-brand-teal-deep text-brand-cream',
  declined: 'bg-brand-sage/40 text-brand-forest',
}

export default async function StaffLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('leave_requests')
    .select('id, kind, start_date, end_date, status, notes, decided_notes')
    .eq('staff_user_id', session.profileId)
    .order('start_date', { ascending: false })

  return (
    <main className="mx-auto max-w-md">
      <div className="flex items-start justify-between">
        <Link href="/staff" className="text-sm text-brand-amber hover:underline">
          ← Hub
        </Link>
        <Link
          href="/staff/leave/new"
          className="rounded-lg bg-brand-forest px-3 py-1.5 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Request
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Your leave
      </h1>

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

      <ul className="mt-6 space-y-2">
        {(rows ?? []).map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-brand-sage/40 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-brand-forest">
                {KIND_LABEL[r.kind] ?? r.kind}
              </p>
              <span
                className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[r.status] ?? ''}`}
              >
                {r.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-brand-slate">
              {r.start_date} → {r.end_date}
            </p>
            {r.notes && (
              <p className="mt-1 text-xs text-brand-slate">{r.notes}</p>
            )}
            {r.decided_notes && (
              <p className="mt-1 text-xs text-brand-forest">
                <strong>Reply:</strong> {r.decided_notes}
              </p>
            )}
          </li>
        ))}
        {(rows?.length ?? 0) === 0 && (
          <li className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No leave requests yet.
          </li>
        )}
      </ul>
    </main>
  )
}
