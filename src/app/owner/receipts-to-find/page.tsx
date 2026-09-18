import Link from 'next/link'
import { loadReceiptsToFind } from '@/lib/bank/receipts-to-find'
import { markNoReceipt, neverNeedsReceipt } from '@/lib/bank/receipt-actions'
import { PendingButton } from '@/components/shared/PendingButton'

export const dynamic = 'force-dynamic'

/**
 * Receipts to find: every bank payment out that nothing in the books accounts
 * for, by who was paid and where, biggest first. Upload receipt opens the
 * Invoice page tied to that payment, so the receipt is matched to it whatever
 * name it carries. See src/lib/bank/receipts-to-find.ts for what's left out.
 */

function fmtMoney(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtMonth(m: string): string {
  return new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ReceiptsToFindPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month: monthRaw } = await searchParams
  const month = monthRaw && /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : null
  const { groups, count, total, months } = await loadReceiptsToFind(month)

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${
      active
        ? 'border-brand-forest bg-brand-forest text-brand-cream'
        : 'border-brand-sage/60 text-brand-forest hover:bg-brand-sage/10'
    }`

  return (
    <main className="mx-auto max-w-4xl">
      <Link href="/owner/invoices-reconcile" className="text-sm text-brand-amber hover:underline">
        ← Invoice reconciliation
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Receipts to find
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Bank payments with no receipt or invoice in the books, by who was paid and where. Press{' '}
        <strong>Upload receipt</strong> on a payment and the receipt is matched to it, whatever
        name is printed on it. Wages, transfers and cash machine withdrawals are left out.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/owner/receipts-to-find" className={chip(month === null)}>
          All months
        </Link>
        {months.map((m) => (
          <Link key={m} href={`/owner/receipts-to-find?month=${m}`} className={chip(month === m)}>
            {fmtMonth(m)}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-brand-forest">
        <strong>{count}</strong> {count === 1 ? 'payment' : 'payments'} ·{' '}
        <strong>{fmtMoney(total)}</strong> without a receipt
        {month ? ` in ${fmtMonth(month)}` : ''}
      </p>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
          Nothing to find — every payment has its receipt.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((g, gi) => (
            <details
              key={g.payee}
              open={gi < 5}
              className="rounded-xl border border-brand-sage/40 bg-white"
            >
              <summary className="flex cursor-pointer items-baseline gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-brand-forest">{g.payee}</span>
                  {g.locations.length > 0 && (
                    <span className="ml-2 text-xs text-brand-slate">
                      {g.locations.slice(0, 3).join(' · ')}
                      {g.locations.length > 3 && ` +${g.locations.length - 3} more`}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-brand-slate">
                  {g.payments.length} {g.payments.length === 1 ? 'payment' : 'payments'}
                </span>
                <span className="shrink-0 font-mono text-sm text-brand-forest">
                  {fmtMoney(g.total)}
                </span>
              </summary>

              <ul className="border-t border-brand-sage/30">
                {g.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-brand-sage/20 px-4 py-2 text-sm last:border-b-0"
                  >
                    <span className="w-24 shrink-0 text-xs text-brand-slate">{fmtDate(p.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-brand-slate">
                      {[p.location, p.detail].filter(Boolean).join(' · ')}
                    </span>
                    <span className="shrink-0 font-mono text-sm text-brand-forest">
                      {fmtMoney(p.amount)}
                    </span>
                    <Link
                      href={`/invoices?for=${p.id}`}
                      className="shrink-0 rounded-lg bg-brand-forest px-3 py-1 text-xs font-medium text-brand-cream hover:bg-brand-olive"
                    >
                      Upload receipt
                    </Link>
                    <form action={markNoReceipt.bind(null, p.id)}>
                      <PendingButton
                        className="shrink-0 text-xs text-brand-slate hover:underline"
                        title="This payment will never have a receipt — take it off the list"
                        pendingText="…"
                      >
                        No receipt needed
                      </PendingButton>
                    </form>
                  </li>
                ))}
              </ul>

              <div className="flex justify-end border-t border-brand-sage/30 px-4 py-2">
                <form action={neverNeedsReceipt.bind(null, g.payee)}>
                  <PendingButton
                    className="text-xs text-brand-amber hover:underline"
                    title={`Leave every payment to ${g.payee} off this list, now and in future`}
                  >
                    {g.payee} never needs a receipt
                  </PendingButton>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  )
}
