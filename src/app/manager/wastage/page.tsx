import { createAdminClient } from '@/lib/supabase/admin'

const REASON_LABEL: Record<string, string> = {
  out_of_date: 'Out of date',
  damaged: 'Damaged',
  dropped: 'Dropped',
  customer_return: 'Customer return',
  spillage: 'Spillage',
  mistake: 'Mistake',
  other: 'Other',
}

export default async function ManagerWastagePage() {
  const admin = createAdminClient()
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const [{ data: rows }, { data: items }, { data: staff }] = await Promise.all([
    admin
      .from('stock_movements')
      .select('id, date, stock_item_id, user_id, quantity, unit_cost, wastage_reason, notes')
      .not('wastage_reason', 'is', null)
      .gte('date', sinceDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    admin.from('stock_items').select('id, name, unit'),
    admin.from('profiles').select('id, name'),
  ])

  const itemById = new Map((items ?? []).map((i) => [i.id, i]))
  const nameById = new Map((staff ?? []).map((p) => [p.id, p.name]))

  // Group by reason for totals
  const byReason = new Map<string, { count: number; cost: number }>()
  for (const r of rows ?? []) {
    const qty = Number(r.quantity ?? 0)
    const cost = (Number(r.unit_cost ?? 0) || 0) * qty
    const reason = r.wastage_reason as string
    const cur = byReason.get(reason) ?? { count: 0, cost: 0 }
    cur.count += 1
    cur.cost += cost
    byReason.set(reason, cur)
  }
  const totalCost = Array.from(byReason.values()).reduce(
    (a, v) => a + v.cost,
    0,
  )

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Wastage — last 30 days
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Cost calculated from each item&apos;s stored cost price at the time of
        log.
      </p>

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <p className="text-sm text-brand-slate">Total cost (last 30 days)</p>
        <p className="mt-1 text-3xl font-semibold text-brand-forest">
          £{totalCost.toFixed(2)}
        </p>

        {byReason.size > 0 && (
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {Array.from(byReason.entries())
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([reason, v]) => (
                <li
                  key={reason}
                  className="rounded-md border border-brand-sage/40 px-3 py-2"
                >
                  <p className="text-xs text-brand-slate">
                    {REASON_LABEL[reason] ?? reason}
                  </p>
                  <p className="font-mono text-brand-forest">
                    £{v.cost.toFixed(2)}{' '}
                    <span className="text-xs text-brand-slate">
                      ({v.count})
                    </span>
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Entries
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">By</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => {
              const it = itemById.get(r.stock_item_id)
              const cost =
                (Number(r.unit_cost ?? 0) || 0) * Number(r.quantity ?? 0)
              return (
                <tr key={r.id} className="border-t border-brand-sage/30">
                  <td className="px-4 py-3 text-brand-forest">
                    {new Date(r.date).toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-brand-forest">
                    {it?.name ?? 'Unknown'}
                    {r.notes && (
                      <p className="text-xs text-brand-slate">{r.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.quantity} {it?.unit ?? ''}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-amber">
                    £{cost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {REASON_LABEL[r.wastage_reason as string] ??
                      r.wastage_reason}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-slate">
                    {nameById.get(r.user_id) ?? 'Unknown'}
                  </td>
                </tr>
              )
            })}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No wastage logged in the last 30 days.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
