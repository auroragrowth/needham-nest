import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteExpense, updateExpense } from '@/lib/finance/actions'
import { ExpenseForm } from '../form'

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: e } = await admin
    .from('expenses')
    .select('id, date, category, vendor, amount, payment_method, reference, notes')
    .eq('id', id)
    .maybeSingle()
  if (!e) notFound()

  const action = updateExpense.bind(null, id)
  const del = deleteExpense.bind(null, id)

  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/expenses"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Expenses
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {e.vendor}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        £{Number(e.amount).toFixed(2)} ·{' '}
        {new Date(e.date).toLocaleDateString([], {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
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

      <ExpenseForm
        action={action}
        submitLabel="Save changes"
        defaults={{
          date: e.date,
          category: e.category,
          vendor: e.vendor,
          amount: Number(e.amount),
          payment_method: e.payment_method,
          reference: e.reference,
          notes: e.notes,
        }}
      />

      <section className="mt-6 rounded-xl border border-brand-amber/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-amber">
          Danger zone
        </h2>
        <form action={del} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
          >
            Delete expense
          </button>
        </form>
      </section>
    </main>
  )
}
