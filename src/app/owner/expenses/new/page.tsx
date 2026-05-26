import Link from 'next/link'
import { createExpense } from '@/lib/finance/actions'
import { ExpenseForm } from '../form'

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/expenses"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Expenses
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Record expense
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <ExpenseForm action={createExpense} submitLabel="Save expense" />
    </main>
  )
}
