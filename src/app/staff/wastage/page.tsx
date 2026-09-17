import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { confirmTodaysWaste } from '@/lib/stock/actions'
import { formatWastedAt, londonParts, REASON_LABEL } from '@/lib/stock/wastage'

function ukToday(): string {
  return londonParts(new Date()).day
}

export default async function WastageListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; closing?: string }>
}) {
  await requireStaffFeature('wastage')
  const params = await searchParams
  const admin = createAdminClient()
  const today = ukToday()
  const [{ data: items }, { data: todays }, { data: check }, { data: people }] = await Promise.all([
    admin
      .from('stock_items')
      .select('id, name, category, unit')
      .eq('active', true)
      .order('category')
      .order('name'),
    admin
      .from('stock_movements')
      .select('id, quantity, wastage_reason, notes, wasted_at, created_at, stock_items(name, unit)')
      .not('wastage_reason', 'is', null)
      .eq('date', today)
      .order('wasted_at'),
    admin.from('waste_checks').select('confirmed_by, confirmed_at, entries').eq('day', today).maybeSingle(),
    admin.from('profiles').select('id, name'),
  ])
  const nameById = new Map((people ?? []).map((p) => [p.id, p.name]))
  const logged = todays ?? []

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Wastage
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Tap an item to log waste. Always log it — the cost helps the manager
        spot patterns.
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

      <section
        className={`mt-6 rounded-2xl border-2 p-4 ${
          check ? 'border-brand-teal/40 bg-brand-teal/5' : 'border-brand-amber bg-brand-amber/10'
        }`}
      >
        <h2 className="font-semibold text-brand-forest">Today&apos;s waste</h2>
        {logged.length === 0 ? (
          <p className="mt-1 text-sm text-brand-slate">Nothing logged yet today.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-brand-forest">
            {logged.map((w) => {
              const item = Array.isArray(w.stock_items) ? w.stock_items[0] : w.stock_items
              return (
                <li key={w.id}>
                  {formatWastedAt(w.wasted_at ?? w.created_at).split(' ').slice(-1)[0]} · {w.quantity}{' '}
                  {item?.unit} {item?.name} · {REASON_LABEL[w.wastage_reason as string] ?? w.wastage_reason}
                  {w.notes && <span className="text-brand-slate"> — {w.notes}</span>}
                </li>
              )
            })}
          </ul>
        )}
        {check ? (
          <p className="mt-3 text-sm text-brand-teal-deep">
            ✓ Confirmed by {nameById.get(check.confirmed_by) ?? 'someone'} at{' '}
            {formatWastedAt(check.confirmed_at).split(' ').slice(-1)[0]}. Log anything else below if more is
            thrown away.
          </p>
        ) : (
          <form action={confirmTodaysWaste} className="mt-3">
            <input type="hidden" name="closing" value={params.closing === '1' ? '1' : ''} />
            {logged.length === 0 && <input type="hidden" name="nothing_wasted" value="yes" />}
            <p className="text-sm text-brand-forest">
              Whoever closes up must do this before clocking out. Log each wasted item below first.
            </p>
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-brand-forest px-4 py-3 text-sm font-semibold text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive"
            >
              {logged.length === 0
                ? 'Nothing was wasted today'
                : `Confirm today's waste is all logged (${logged.length})`}
            </button>
          </form>
        )}
      </section>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Log waste
      </h2>
      <ul className="mt-2 space-y-2">
        {(items ?? []).length === 0 && (
          <li className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No stock items configured yet.
          </li>
        )}
        {(items ?? []).map((it) => (
          <li key={it.id}>
            <Link
              href={`/staff/wastage/${it.id}`}
              className="block rounded-2xl border border-brand-sage/40 bg-white p-4 transition active:scale-[0.98] hover:border-brand-teal/60 hover:bg-brand-teal/5"
            >
              <p className="font-medium text-brand-forest">{it.name}</p>
              <p className="mt-0.5 text-xs text-brand-slate">
                {it.category ?? '—'} · per {it.unit}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
