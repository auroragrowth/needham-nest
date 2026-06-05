import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

export default async function StaffRotaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: shifts } = await admin
    .from('rota_shifts')
    .select('id, date, start_time, end_time, notes, published')
    .eq('staff_user_id', session.profileId)
    .gte('date', today)
    .order('date')
    .order('start_time')

  const hasDraft = (shifts ?? []).some((s) => !s.published)

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Your shifts
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Upcoming shifts. Draft shifts are still being worked on — let Vic know
        if anything looks wrong.
      </p>

      {hasDraft && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          Some of these are still <strong>DRAFT</strong> — they&apos;ll
          change to confirmed once Vic publishes the week.
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {(shifts ?? []).map((s) => (
          <li
            key={s.id}
            className={`rounded-2xl border bg-white p-4 ${
              s.published ? 'border-brand-sage/40' : 'border-brand-amber/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-brand-forest">
                {new Date(s.date).toLocaleDateString([], {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
              {!s.published && (
                <span className="rounded bg-brand-amber/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-forest">
                  Draft
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-brand-slate">
              {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
            </p>
            {s.notes && (
              <p className="mt-1 text-xs text-brand-slate">{s.notes}</p>
            )}
          </li>
        ))}
        {(shifts?.length ?? 0) === 0 && (
          <li className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No shifts scheduled yet.
          </li>
        )}
      </ul>
    </main>
  )
}
