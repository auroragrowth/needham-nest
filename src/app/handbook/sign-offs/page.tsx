import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { daysBetween, formatDay, londonToday } from '@/lib/handbook/signoff'
import { PrintButton } from '@/components/shared/PrintButton'

/** Who has read and signed the handbook. Owner and manager only. */
export default async function HandbookSignoffsPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/handbook/sign-offs')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/handbook')

  const admin = createAdminClient()
  const today = londonToday()

  const { data: round } = await admin
    .from('handbook_signoff_rounds')
    .select('id, title, started_on, due_on')
    .eq('active', true)
    .order('started_on', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!round) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/handbook" className="text-sm text-brand-amber hover:underline">← Handbook</Link>
        <h1 className="mt-2 text-2xl font-semibold text-brand-forest">Handbook sign-offs</h1>
        <p className="mt-4 text-sm text-brand-slate">No sign-off round is running.</p>
      </main>
    )
  }

  const [{ data: rows }, { count: totalArticles }, { data: reads }, { data: reminders }] =
    await Promise.all([
      admin
        .from('handbook_signoffs')
        .select('id, profile_id, read_confirmed_at, signed_name, signature_data, signed_on, signed_at, profiles(name, email)')
        .eq('round_id', round.id),
      admin.from('handbook_articles').select('id', { count: 'exact', head: true }).eq('active', true),
      admin.from('handbook_reads').select('profile_id').eq('round_id', round.id),
      admin
        .from('handbook_reminder_log')
        .select('profile_id, sent_on, ok')
        .eq('round_id', round.id)
        .eq('kind', 'staff'),
    ])

  const readCount = new Map<string, number>()
  for (const r of reads ?? []) readCount.set(r.profile_id, (readCount.get(r.profile_id) ?? 0) + 1)
  const reminderCount = new Map<string, number>()
  for (const r of reminders ?? []) {
    if (r.ok && r.profile_id) reminderCount.set(r.profile_id, (reminderCount.get(r.profile_id) ?? 0) + 1)
  }

  type Row = NonNullable<typeof rows>[number]
  const nameOf = (r: Row) => {
    const p = r.profiles as unknown as { name: string; email: string | null } | null
    return p?.name ?? '—'
  }
  const emailOf = (r: Row) => {
    const p = r.profiles as unknown as { name: string; email: string | null } | null
    return p?.email ?? null
  }
  const list = [...(rows ?? [])].sort((a, b) => {
    if (Boolean(a.signed_at) !== Boolean(b.signed_at)) return a.signed_at ? 1 : -1
    return nameOf(a).localeCompare(nameOf(b))
  })

  const signed = list.filter((r) => r.signed_at).length
  const daysLeft = daysBetween(today, round.due_on)
  const total = totalArticles ?? 0

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <Link href="/handbook" className="text-sm text-brand-amber hover:underline">← Handbook</Link>
        <PrintButton />
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">Handbook sign-offs</h1>
      <p className="mt-1 text-sm text-brand-slate">
        {round.title}. Started {formatDay(round.started_on)}, due {formatDay(round.due_on)}
        {daysLeft >= 0 ? ` (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : ` (${-daysLeft} days overdue)`}.
      </p>
      <p className="mt-3 text-lg font-semibold text-brand-forest">
        {signed} of {list.length} signed
      </p>
      <p className="text-xs text-brand-slate print:hidden">
        Anyone not signed gets a reminder email at 9am every day, and it shows on their home screen.
      </p>

      <ul className="mt-6 space-y-3">
        {list.map((r) => {
          const n = readCount.get(r.profile_id) ?? 0
          const sent = reminderCount.get(r.profile_id) ?? 0
          return (
            <li key={r.id} className="break-inside-avoid rounded-xl border border-brand-sage/40 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-brand-forest">{nameOf(r)}</p>
                {r.signed_at ? (
                  <span className="rounded bg-brand-teal/15 px-2 py-0.5 text-xs font-medium text-brand-teal-deep">
                    Signed {r.signed_on ? formatDay(r.signed_on) : ''}
                  </span>
                ) : r.read_confirmed_at ? (
                  <span className="rounded bg-brand-amber/20 px-2 py-0.5 text-xs font-medium text-brand-forest">
                    Read, not signed yet
                  </span>
                ) : (
                  <span className="rounded bg-brand-amber/20 px-2 py-0.5 text-xs font-medium text-brand-forest">
                    {n} of {total} read
                  </span>
                )}
              </div>
              {r.signed_at ? (
                <div className="mt-2">
                  <p className="text-sm text-brand-slate">
                    Signed as <strong className="text-brand-forest">{r.signed_name}</strong>, at{' '}
                    {new Date(r.signed_at).toLocaleString('en-GB', {
                      timeZone: 'Europe/London',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {r.signature_data && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.signature_data}
                      alt={`Signature of ${r.signed_name}`}
                      className="mt-2 h-20 w-full max-w-sm rounded border border-brand-sage/30 object-contain"
                    />
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-brand-slate">
                  {emailOf(r) ? `${sent} reminder${sent === 1 ? '' : 's'} emailed` : 'No email on file, so no reminder emails. Home-screen prompt only.'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
