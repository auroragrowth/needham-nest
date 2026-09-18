import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaffFeature } from '@/lib/permissions'
import { confirmMyWaste } from '@/lib/stock/actions'
import { formatWastedAt, REASON_LABEL } from '@/lib/stock/wastage'
import { getShiftWaste } from '@/lib/stock/waste-confirm'
import { WastePicker } from './WastePicker'

export default async function WastageListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; clockout?: string }>
}) {
  const session = await requireStaffFeature('wastage')
  const params = await searchParams
  const admin = createAdminClient()

  const [{ data: allItems }, shiftWaste] = await Promise.all([
    admin
      .from('stock_items')
      .select('id, name, category, unit')
      .eq('active', true)
      .order('category')
      .order('name'),
    getShiftWaste(session.profileId),
  ])
  const items = allItems ?? []
  const { shift, confirmed, mine } = shiftWaste
  const clockout = params.clockout === '1'

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

      {shift && (
        <section
          className={`mt-6 rounded-2xl border-2 p-4 ${
            confirmed ? 'border-brand-teal/40 bg-brand-teal/5' : 'border-brand-amber bg-brand-amber/10'
          }`}
        >
          <h2 className="font-semibold text-brand-forest">Waste from your shift</h2>
          {mine.length === 0 ? (
            <p className="mt-1 text-sm text-brand-slate">You haven&apos;t logged any waste this shift.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-brand-forest">
              {mine.map((w) => (
                <li key={w.id}>
                  {formatWastedAt(w.wasted_at ?? w.created_at).split(' ').slice(-1)[0]} · {w.quantity} {w.unit}{' '}
                  {w.item} · {REASON_LABEL[w.wastage_reason ?? ''] ?? w.wastage_reason}
                  {w.notes && <span className="text-brand-slate"> — {w.notes}</span>}
                </li>
              ))}
            </ul>
          )}
          {confirmed ? (
            <p className="mt-3 text-sm text-brand-teal-deep">
              ✓ Confirmed. Log anything else here if more gets thrown away before you go.
            </p>
          ) : (
            <form action={confirmMyWaste} className="mt-3">
              <input type="hidden" name="clockout" value={clockout ? '1' : ''} />
              {mine.length === 0 && <input type="hidden" name="nothing_wasted" value="yes" />}
              <p className="text-sm text-brand-forest">
                Everyone does this before clocking out. Log each wasted item below first.
              </p>
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-brand-forest px-4 py-3 text-sm font-semibold text-brand-cream transition active:scale-[0.98] hover:bg-brand-olive"
              >
                {mine.length === 0
                  ? 'I wasted nothing this shift'
                  : `Confirm my waste is all logged (${mine.length})`}
              </button>
            </form>
          )}
        </section>
      )}

      <WastePicker items={items} />

      <details className="mt-6">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Or browse every item
        </summary>
        <ul className="mt-2 space-y-2">
          {items.map((it) => (
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
      </details>
    </main>
  )
}
