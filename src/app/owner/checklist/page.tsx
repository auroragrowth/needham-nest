import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const FREQ_LABEL: Record<string, string> = {
  open: 'Opening',
  mid: 'Mid-shift',
  close: 'Closing',
  daily: 'Daily',
}
const FREQ_ORDER: Record<string, number> = { open: 0, mid: 1, close: 2, daily: 3 }

export default async function ChecklistOwnerPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: tasks } = await admin
    .from('cleaning_tasks')
    .select('id, name, frequency, area, sort_order, active')
    .order('active', { ascending: false })
    .order('sort_order')
    .order('name')

  const rows = (tasks ?? []).slice().sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    const f = (FREQ_ORDER[a.frequency] ?? 99) - (FREQ_ORDER[b.frequency] ?? 99)
    if (f !== 0) return f
    return a.sort_order - b.sort_order
  })

  return (
    <main className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Daily checklist
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Pre-defined tasks staff tick off on the tablet. Group by opening,
            mid-shift, closing, or all-day.
          </p>
        </div>
        <Link
          href="/owner/checklist/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add task
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className={`border-t border-brand-sage/30 ${
                  t.active ? '' : 'text-brand-slate'
                }`}
              >
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {t.name}
                </td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide">
                  {FREQ_LABEL[t.frequency] ?? t.frequency}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {t.area ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {t.active ? (
                    <span className="text-brand-teal-deep">Active</span>
                  ) : (
                    <span className="text-brand-slate">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/checklist/${t.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No tasks yet. Add a few — &quot;Wipe down pass&quot;,
                  &quot;Empty bins&quot;, &quot;Mop floor&quot; — and they&apos;ll
                  appear on the staff tablet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
