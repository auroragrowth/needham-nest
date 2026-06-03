import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { SortableTasks, type Task } from './SortableTasks'

const FREQ_LABEL: Record<string, string> = {
  open: 'Start-up / opening',
  mid: 'Mid-shift',
  close: 'Close-down',
  daily: 'Daily (any time)',
}
const FREQ_ORDER: Array<'open' | 'mid' | 'close' | 'daily'> = [
  'open',
  'mid',
  'close',
  'daily',
]

export default async function ChecklistAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'owner' && session.role !== 'manager') redirect('/')

  const admin = createAdminClient()
  const { data: tasks } = await admin
    .from('cleaning_tasks')
    .select('id, name, frequency, area, sort_order, active')
    .order('sort_order')
    .order('name')

  // Group by frequency, sort_order already respected by the query
  const byFreq = new Map<string, Task[]>()
  for (const f of FREQ_ORDER) byFreq.set(f, [])
  for (const t of tasks ?? []) {
    const bucket = byFreq.get(t.frequency)
    if (!bucket) continue
    bucket.push({
      id: t.id,
      name: t.name,
      area: t.area,
      active: t.active,
    })
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link
        href="/"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Checklist admin
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Build the start-up, mid-shift and close-down checklists. Drag
            <span className="mx-1 select-none rounded bg-brand-sage/20 px-1 font-mono text-brand-forest">
              ⋮⋮
            </span>
            to reorder within each list — saves automatically.
          </p>
        </div>
        <Link
          href="/admin/checklist/new"
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
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <div className="mt-6 space-y-8">
        {FREQ_ORDER.map((f) => (
          <section key={f}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              {FREQ_LABEL[f]}
            </h2>
            <SortableTasks initial={byFreq.get(f) ?? []} />
          </section>
        ))}
      </div>
    </main>
  )
}
