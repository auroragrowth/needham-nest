import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { recordWastage } from '@/lib/stock/actions'
import { londonParts, MAX_DAYS_BACK, WASTAGE_REASONS } from '@/lib/stock/wastage'

/** Now and the earliest allowed day, in UK time, to prefill and bound the form. */
function wasteWindow() {
  const now = new Date()
  return {
    now: londonParts(now),
    earliestDay: londonParts(new Date(now.getTime() - MAX_DAYS_BACK * 24 * 60 * 60 * 1000)).day,
  }
}

export default async function WastagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requireStaffFeature('wastage')
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: it } = await admin
    .from('stock_items')
    .select('id, name, unit, category, active')
    .eq('id', id)
    .maybeSingle()
  if (!it || !it.active) notFound()

  const action = recordWastage.bind(null, id)
  const { now, earliestDay } = wasteWindow()

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/staff/wastage"
        className="text-sm text-brand-amber hover:underline"
      >
        ← All items
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {it.name}
      </h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-brand-slate">
        {it.category ?? '—'} · per {it.unit}
      </p>

      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <form
        action={action}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-5"
      >
        <div>
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-brand-forest"
          >
            Quantity ({it.unit})
            <span className="ml-1 text-brand-amber">*</span>
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            inputMode="decimal"
            autoFocus
            placeholder="0"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-2xl text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-brand-forest"
          >
            Reason <span className="ml-1 text-brand-amber">*</span>
          </label>
          <select
            id="reason"
            name="reason"
            required
            defaultValue=""
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          >
            <option value="" disabled>
              Pick a reason
            </option>
            {WASTAGE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="wasted_day"
              className="block text-sm font-medium text-brand-forest"
            >
              Date wasted <span className="ml-1 text-brand-amber">*</span>
            </label>
            <input
              id="wasted_day"
              name="wasted_day"
              type="date"
              required
              defaultValue={now.day}
              min={earliestDay}
              max={now.day}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <div>
            <label
              htmlFor="wasted_time"
              className="block text-sm font-medium text-brand-forest"
            >
              Time wasted <span className="ml-1 text-brand-amber">*</span>
            </label>
            <input
              id="wasted_time"
              name="wasted_time"
              type="time"
              required
              defaultValue={now.time}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
          <p className="col-span-2 -mt-1 text-xs text-brand-slate">
            When it was thrown away, UK time. Change it if you&apos;re logging it later.
          </p>
        </div>

        <div>
          <label
            htmlFor="why"
            className="block text-sm font-medium text-brand-forest"
          >
            Why was it wasted? <span className="ml-1 text-brand-amber">*</span>
          </label>
          <textarea
            id="why"
            name="why"
            required
            minLength={3}
            maxLength={500}
            rows={3}
            placeholder="e.g. past its best-before date at close"
            className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-2xl bg-brand-forest px-6 py-4 text-lg font-semibold text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive"
        >
          Record wastage
        </button>
      </form>
    </main>
  )
}
