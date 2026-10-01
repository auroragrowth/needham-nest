import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { addHandoverNote } from '@/lib/handover/actions'
import { PendingButton } from '@/components/shared/PendingButton'
import { SECTIONS } from '@/lib/sections'

export const dynamic = 'force-dynamic'

/** Notes from the last three days, newest first: enough to cover a weekend. */
const DAYS_SHOWN = 3

function sinceIso(): string {
  return new Date(Date.now() - DAYS_SHOWN * 24 * 60 * 60 * 1000).toISOString()
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function HandoverPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const since = sinceIso()
  const admin = createAdminClient()
  const [{ data: notes }, { data: people }] = await Promise.all([
    admin
      .from('handover_notes')
      .select('id, body, author_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ])
  const nameById = new Map((people ?? []).map((p) => [p.id, p.name as string]))
  const s = SECTIONS.people

  return (
    <main className="mx-auto max-w-md">
      <h1 className={`text-2xl font-semibold tracking-tight ${s.heading}`}>Handover notes</h1>
      <p className="mt-1 text-sm text-brand-slate">
        Anything the next shift needs to know. Read these when you come on.
      </p>

      {params.notice && (
        <p className="mt-3 rounded border border-brand-teal bg-white p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-3 rounded border border-people bg-people-tint p-3 text-sm text-people-ink">
          {params.error}
        </p>
      )}

      <form action={addHandoverNote} className={`mt-5 rounded-2xl border-2 p-4 ${s.tile}`}>
        <label htmlFor="handover-body" className={`block text-sm font-semibold ${s.ink}`}>
          Leave a note
        </label>
        <textarea
          id="handover-body"
          name="body"
          required
          maxLength={2000}
          rows={3}
          placeholder="e.g. Milk delivery was short — 4 left in the fridge"
          className="mt-2 w-full rounded-lg border border-brand-sage bg-white p-3 text-base text-brand-forest"
        />
        <PendingButton
          className="mt-3 w-full rounded-lg bg-people px-4 py-3 font-semibold text-white"
          pendingText="Saving…"
        >
          Save note
        </PendingButton>
      </form>

      <ul className="mt-6 space-y-2">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="rounded-2xl border border-brand-sage bg-white p-4">
            <p className="whitespace-pre-wrap text-brand-forest">{n.body}</p>
            <p className="mt-2 text-xs text-brand-slate">
              {nameById.get(n.author_id) ?? 'Someone'} · {fmtWhen(n.created_at)}
            </p>
          </li>
        ))}
        {(notes?.length ?? 0) === 0 && (
          <li className="rounded-2xl border border-brand-sage bg-white p-5 text-center text-sm text-brand-slate">
            No notes in the last {DAYS_SHOWN} days.
          </li>
        )}
      </ul>
    </main>
  )
}
