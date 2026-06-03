import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  deactivateTask,
  reactivateTask,
  updateTask,
} from '@/lib/checklist/actions'

const FREQ_OPTIONS = [
  { value: 'open', label: 'Opening' },
  { value: 'mid', label: 'Mid-shift' },
  { value: 'close', label: 'Closing' },
  { value: 'daily', label: 'Daily' },
]

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: t } = await admin
    .from('cleaning_tasks')
    .select('id, name, frequency, area, sort_order, active')
    .eq('id', id)
    .maybeSingle()
  if (!t) notFound()

  const action = updateTask.bind(null, id)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/admin/checklist"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All tasks
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {t.name}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {t.active ? 'Active' : 'Inactive'} ·{' '}
        {FREQ_OPTIONS.find((f) => f.value === t.frequency)?.label ?? t.frequency}
      </p>

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

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-brand-forest"
          >
            Task
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={t.name}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="frequency"
            className="block text-sm font-medium text-brand-forest"
          >
            When
          </label>
          <select
            id="frequency"
            name="frequency"
            required
            defaultValue={t.frequency}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="area"
            className="block text-sm font-medium text-brand-forest"
          >
            Area
          </label>
          <input
            id="area"
            name="area"
            type="text"
            defaultValue={t.area ?? ''}
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="sort_order"
            className="block text-sm font-medium text-brand-forest"
          >
            Sort order
          </label>
          <input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={t.sort_order}
            className="mt-1 w-24 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Save changes
        </button>
      </form>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          {t.active ? 'Deactivate' : 'Reactivate'}
        </h2>
        <p className="mt-1 text-sm text-brand-slate">
          {t.active
            ? 'Hides this task from the staff checklist. Past log entries are preserved.'
            : 'Brings the task back to the staff checklist.'}
        </p>
        <form
          action={t.active ? deactivateTask.bind(null, id) : reactivateTask.bind(null, id)}
          className="mt-3"
        >
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              t.active
                ? 'border border-brand-amber/60 bg-brand-amber/10 text-brand-forest hover:bg-brand-amber/20'
                : 'bg-brand-teal-deep text-brand-cream hover:bg-brand-teal'
            }`}
          >
            {t.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </form>
      </section>
    </main>
  )
}
