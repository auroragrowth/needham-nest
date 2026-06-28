'use client'

import { deleteExpense } from '@/lib/invoices/actions'

export function DeleteReceiptButton({
  expenseId,
  vendor,
  amount,
  compact,
}: {
  expenseId: string
  vendor: string | null
  amount: number
  compact?: boolean
}) {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      `Delete this receipt?\n\n${vendor ?? 'Unknown'} — £${amount.toFixed(2)}\n\nThe file, the expense row, and any till cash-out it created will be removed. This can't be undone.`,
    )
    if (!ok) e.preventDefault()
  }

  return (
    <form action={deleteExpense.bind(null, expenseId)} onSubmit={onSubmit}>
      <button
        type="submit"
        className={
          compact
            ? 'text-xs text-brand-amber hover:underline'
            : 'rounded-lg border border-brand-amber/60 bg-white px-3 py-1.5 text-sm font-semibold text-brand-amber hover:bg-brand-amber/10'
        }
        title="Delete this receipt and any linked cash entry"
      >
        🗑 {compact ? '' : 'Delete'}
      </button>
    </form>
  )
}
