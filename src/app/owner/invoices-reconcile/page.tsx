import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  cleanupDuplicates,
  manuallyMatchExpense,
  markExpenseAsDirectorPaid,
  markExpenseAsPaidInCash,
  mergeIntoExpense,
  runAutoMatch,
} from '@/lib/invoices/actions'
import { DeleteReceiptButton } from './DeleteReceiptButton'

export const dynamic = 'force-dynamic'

type Expense = {
  id: string
  date: string
  vendor: string | null
  amount: number
  reference: string | null
  receipt_path: string | null
  additional_receipt_paths: string[] | null
  ai_extracted: boolean
  director_loan_id: string | null
  paid_in_cash: boolean
  reconciled_at: string | null
}

type Txn = {
  id: string
  date: string
  description: string
  amount: number
  matched_expense_id: string | null
}

function fmtMoney(n: number): string {
  return `£${n.toFixed(2)}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; errors?: string }>
}) {
  const sp = await searchParams
  const admin = createAdminClient()

  const [{ data: expensesRaw }, { data: txnsRaw }] = await Promise.all([
    admin
      .from('expenses')
      .select(
        'id, date, vendor, amount, reference, receipt_path, additional_receipt_paths, ai_extracted, director_loan_id, paid_in_cash, reconciled_at',
      )
      .order('date', { ascending: false })
      .limit(200),
    admin
      .from('bank_transactions')
      .select('id, date, description, amount, matched_expense_id')
      .order('date', { ascending: false })
      .limit(500),
  ])

  const expenses = (expensesRaw ?? []) as Expense[]
  const txns = (txnsRaw ?? []) as Txn[]
  const matchedExpenseIds = new Set(
    txns.filter((t) => t.matched_expense_id).map((t) => t.matched_expense_id!),
  )

  const matched: Expense[] = []
  const directorPaid: Expense[] = []
  const cashPaid: Expense[] = []
  const unmatched: Expense[] = []
  for (const e of expenses) {
    if (e.paid_in_cash) cashPaid.push(e)
    else if (e.director_loan_id) directorPaid.push(e)
    else if (matchedExpenseIds.has(e.id)) matched.push(e)
    else unmatched.push(e)
  }
  const cashTotal = cashPaid.reduce((a, e) => a + Number(e.amount), 0)

  // Sign URLs for every receipt + any additional pages from merged
  // multi-page uploads. previewUrls maps expense id → ordered list of
  // signed URLs (primary first, then merged-in pages).
  const previewUrls = new Map<string, string[]>()
  for (const e of expenses) {
    const paths = [
      ...(e.receipt_path ? [e.receipt_path] : []),
      ...(e.additional_receipt_paths ?? []),
    ]
    if (paths.length === 0) continue
    const signedList: string[] = []
    for (const p of paths) {
      const { data: signed } = await admin.storage
        .from('supplier-invoices')
        .createSignedUrl(p, 60 * 60)
      if (signed?.signedUrl) signedList.push(signed.signedUrl)
    }
    if (signedList.length > 0) previewUrls.set(e.id, signedList)
  }

  // Build a quick lookup of candidate bank txns (debits with no match yet)
  // for the manual-match dropdown on the unmatched panel.
  const unmatchedTxns = txns.filter(
    (t) => t.matched_expense_id === null && Number(t.amount) < 0,
  )

  // For the merge dropdown — every other expense is a potential target.
  // Sort by date desc so the most recent options come first.
  const allOtherExpensesById = new Map(expenses.map((e) => [e.id, e]))

  return (
    <main className="mx-auto max-w-5xl">
      <Link
        href="/owner"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <header className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Invoice reconciliation
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Match supplier invoices against the bank statement. Anything
            unmatched is flagged — likely paid by the director and needs to
            go to the loan account.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/owner/invoices-upload"
            className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
          >
            + Upload more
          </Link>
          <form
            action={async () => {
              'use server'
              await runAutoMatch()
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-brand-sage/60 px-4 py-2 text-sm text-brand-forest hover:bg-brand-sage/10"
            >
              Re-run auto-match
            </button>
          </form>
          <form
            action={async () => {
              'use server'
              await cleanupDuplicates()
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-brand-sage/60 px-4 py-2 text-sm text-brand-forest hover:bg-brand-sage/10"
              title="Delete unreconciled receipts that duplicate one already settled"
            >
              🧹 Clean duplicates
            </button>
          </form>
        </div>
      </header>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.errors && (
        <p className="mt-2 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-xs text-brand-forest">
          {sp.errors}
        </p>
      )}

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat
          label="Matched"
          value={`${matched.length}`}
          tone="ok"
        />
        <Stat
          label="Unmatched (flagged)"
          value={`${unmatched.length}`}
          tone={unmatched.length === 0 ? 'ok' : 'warn'}
        />
        <Stat
          label="Paid from till"
          value={`${cashPaid.length}`}
          sub={cashTotal > 0 ? `£${cashTotal.toFixed(2)} cash out` : undefined}
          tone="info"
        />
        <Stat
          label="Director-paid"
          value={`${directorPaid.length}`}
          tone="info"
        />
      </section>

      {/* UNMATCHED — top of page so it's hard to miss */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-amber">
          ⚠ Unmatched / possibly director-paid
        </h2>
        <p className="mt-1 text-xs text-brand-slate">
          No bank transaction matched these by amount + supplier text. Move
          them to the director&apos;s loan or manually pick a bank line.
        </p>
        {unmatched.length === 0 ? (
          <p className="mt-3 rounded-xl border border-brand-sage/40 bg-white p-4 text-sm text-brand-slate">
            Nothing to flag — everything reconciled.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {unmatched.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-brand-amber/60 bg-brand-amber/5 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-brand-forest">
                      {e.vendor ?? 'Unknown supplier'}{' '}
                      <span className="ml-1 font-mono text-sm">
                        {fmtMoney(Number(e.amount))}
                      </span>
                    </p>
                    <p className="text-xs text-brand-slate">
                      {fmtDate(e.date)}
                      {e.reference && ` · Ref ${e.reference}`}
                      {e.ai_extracted && ' · AI-extracted'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(previewUrls.get(e.id) ?? []).length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        {(previewUrls.get(e.id) ?? []).map((url, i, arr) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-brand-sage/60 bg-white px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-sage/10"
                          >
                            👁 {arr.length === 1 ? 'Preview' : `Page ${i + 1}`}
                          </a>
                        ))}
                      </span>
                    )}
                    <form action={markExpenseAsPaidInCash.bind(null, e.id)}>
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-brand-cream hover:bg-brand-teal-deep"
                        title="Deduct this amount from the till's cash on hand"
                      >
                        💵 Paid from till
                      </button>
                    </form>
                    <form action={markExpenseAsDirectorPaid.bind(null, e.id)}>
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-amber px-3 py-1.5 text-sm font-semibold text-brand-forest hover:bg-brand-amber/90"
                      >
                        🏛 Director&apos;s loan →
                      </button>
                    </form>
                    <DeleteReceiptButton
                      expenseId={e.id}
                      vendor={e.vendor}
                      amount={Number(e.amount)}
                    />
                  </div>
                </div>
                <form
                  action={async (fd: FormData) => {
                    'use server'
                    const tid = String(fd.get('txn_id') ?? '')
                    if (tid)
                      await manuallyMatchExpense(e.id, tid)
                  }}
                  className="mt-3 flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="text-brand-slate">Or pick a bank line:</span>
                  <select
                    name="txn_id"
                    className="rounded-md border border-brand-sage/60 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">— pick —</option>
                    {unmatchedTxns
                      .filter(
                        (t) =>
                          Math.abs(
                            Number(t.amount) + Math.abs(Number(e.amount)),
                          ) < 0.01,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {fmtDate(t.date)} · {t.description.slice(0, 40)} ·{' '}
                          {fmtMoney(Number(t.amount))}
                        </option>
                      ))}
                    {unmatchedTxns
                      .filter(
                        (t) =>
                          Math.abs(
                            Number(t.amount) + Math.abs(Number(e.amount)),
                          ) >= 0.01,
                      )
                      .slice(0, 20)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          (other) {fmtDate(t.date)} ·{' '}
                          {t.description.slice(0, 40)} ·{' '}
                          {fmtMoney(Number(t.amount))}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-brand-sage/60 px-2 py-1 text-xs text-brand-forest hover:bg-brand-sage/10"
                  >
                    Match
                  </button>
                </form>
                <form
                  action={async (fd: FormData) => {
                    'use server'
                    const tid = String(fd.get('merge_target_id') ?? '')
                    if (tid) await mergeIntoExpense(e.id, tid)
                  }}
                  className="mt-2 flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="text-brand-slate">
                    Or merge this into another (multi-page receipt):
                  </span>
                  <select
                    name="merge_target_id"
                    className="rounded-md border border-brand-sage/60 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">— pick the primary —</option>
                    {expenses
                      .filter((other) => other.id !== e.id)
                      .slice(0, 30)
                      .map((other) => (
                        <option key={other.id} value={other.id}>
                          {fmtDate(other.date)} ·{' '}
                          {(other.vendor ?? 'Unknown').slice(0, 25)} ·{' '}
                          {fmtMoney(Number(other.amount))}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-brand-sage/60 px-2 py-1 text-xs text-brand-forest hover:bg-brand-sage/10"
                  >
                    Merge →
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* MATCHED */}
      {matched.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            ✓ Matched to bank
          </h2>
          <ul className="mt-3 space-y-1">
            {matched.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-2 rounded-md border border-brand-sage/30 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">
                    {e.vendor ?? 'Unknown'}
                  </span>
                  <span className="ml-2 text-xs text-brand-slate">
                    {fmtDate(e.date)}
                    {e.reference && ` · ${e.reference}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {(previewUrls.get(e.id) ?? []).map((url, i, arr) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-amber hover:underline"
                      title={arr.length > 1 ? `Page ${i + 1} of ${arr.length}` : 'Preview'}
                    >
                      👁{arr.length > 1 ? ` p${i + 1}` : ''}
                    </a>
                  ))}
                  <DeleteReceiptButton
                    expenseId={e.id}
                    vendor={e.vendor}
                    amount={Number(e.amount)}
                    compact
                  />
                  <span className="font-mono text-xs">
                    {fmtMoney(Number(e.amount))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CASH PAID */}
      {cashPaid.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            💵 Paid from till ({fmtMoney(cashTotal)} cash out)
          </h2>
          <ul className="mt-3 space-y-1">
            {cashPaid.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-2 rounded-md border border-brand-sage/30 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">
                    {e.vendor ?? 'Unknown'}
                  </span>
                  <span className="ml-2 text-xs text-brand-slate">
                    {fmtDate(e.date)}
                    {e.reference && ` · ${e.reference}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {(previewUrls.get(e.id) ?? []).map((url, i, arr) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-amber hover:underline"
                      title={arr.length > 1 ? `Page ${i + 1} of ${arr.length}` : 'Preview'}
                    >
                      👁{arr.length > 1 ? ` p${i + 1}` : ''}
                    </a>
                  ))}
                  <DeleteReceiptButton
                    expenseId={e.id}
                    vendor={e.vendor}
                    amount={Number(e.amount)}
                    compact
                  />
                  <span className="font-mono text-xs">
                    {fmtMoney(Number(e.amount))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-brand-slate">
            Each line above created a matching cash-out movement on{' '}
            <Link className="text-brand-amber hover:underline" href="/manager/cash">
              /manager/cash
            </Link>
            , so the till balance reflects the cost.
          </p>
        </section>
      )}

      {/* DIRECTOR PAID */}
      {directorPaid.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            🏛 Posted to director&apos;s loan
          </h2>
          <ul className="mt-3 space-y-1">
            {directorPaid.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-2 rounded-md border border-brand-sage/30 bg-white px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">
                    {e.vendor ?? 'Unknown'}
                  </span>
                  <span className="ml-2 text-xs text-brand-slate">
                    {fmtDate(e.date)}
                    {e.reference && ` · ${e.reference}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {(previewUrls.get(e.id) ?? []).map((url, i, arr) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-amber hover:underline"
                      title={arr.length > 1 ? `Page ${i + 1} of ${arr.length}` : 'Preview'}
                    >
                      👁{arr.length > 1 ? ` p${i + 1}` : ''}
                    </a>
                  ))}
                  <DeleteReceiptButton
                    expenseId={e.id}
                    vendor={e.vendor}
                    amount={Number(e.amount)}
                    compact
                  />
                  <span className="font-mono text-xs">
                    {fmtMoney(Number(e.amount))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-brand-slate">
            See <Link className="text-brand-amber hover:underline" href="/owner/director-loan">/owner/director-loan</Link> for the
            running balance.
          </p>
        </section>
      )}
    </main>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone: 'ok' | 'warn' | 'info'
}) {
  const border =
    tone === 'ok'
      ? 'border-brand-teal/60'
      : tone === 'warn'
        ? 'border-brand-amber/60'
        : 'border-brand-sage/40'
  return (
    <div className={`rounded-xl border-2 ${border} bg-white p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-brand-forest">{value}</p>
      {sub && <p className="mt-1 text-xs text-brand-slate">{sub}</p>}
    </div>
  )
}
