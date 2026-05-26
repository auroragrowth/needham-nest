import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteWage, markWagePaid } from '@/lib/wages/actions'

export default async function WageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: w } = await admin
    .from('wage_payments')
    .select(
      'id, staff_user_id, period_start, period_end, hours, hourly_rate, gross, paid_at, paid_via, reference, expense_id',
    )
    .eq('id', id)
    .maybeSingle()
  if (!w) notFound()

  const { data: staff } = await admin
    .from('profiles')
    .select('name')
    .eq('id', w.staff_user_id)
    .maybeSingle()

  const action = markWagePaid.bind(null, id)
  const del = deleteWage.bind(null, id)

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/wages"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Wages
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {staff?.name ?? 'Unknown'}
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        {w.period_start} → {w.period_end} · {w.hours} hours @ £
        {Number(w.hourly_rate ?? 0).toFixed(2)}/hr = £
        {Number(w.gross).toFixed(2)}
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

      {w.paid_at ? (
        <section className="mt-6 rounded-xl border border-brand-teal/40 bg-brand-teal/10 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Paid
          </h2>
          <p className="mt-2 text-brand-forest">
            {new Date(w.paid_at).toLocaleDateString([], {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            {w.paid_via && ` · via ${w.paid_via}`}
            {w.reference && ` · ref ${w.reference}`}
          </p>
          {w.expense_id && (
            <p className="mt-2 text-xs text-brand-slate">
              Linked to{' '}
              <Link
                href={`/owner/expenses/${w.expense_id}`}
                className="text-brand-amber hover:underline"
              >
                expense
              </Link>
            </p>
          )}
        </section>
      ) : (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Mark as paid
          </h2>
          <form action={action} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-forest">
                  Paid via
                </label>
                <input
                  name="paid_via"
                  type="text"
                  placeholder="Bank transfer"
                  className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-forest">
                  Reference
                </label>
                <input
                  name="reference"
                  type="text"
                  className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="create_expense"
                defaultChecked
                className="h-4 w-4 rounded border-brand-sage/60 accent-brand-teal-deep"
              />
              <span className="text-brand-forest">
                Also create matching expense (category: staff)
              </span>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            >
              Mark as paid
            </button>
          </form>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-brand-amber/40 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-brand-amber">
          Delete
        </h2>
        <form action={del} className="mt-3">
          <button
            type="submit"
            className="rounded-lg border border-brand-amber/60 bg-brand-amber/10 px-4 py-2 text-sm font-medium text-brand-forest hover:bg-brand-amber/20"
          >
            Delete wage record
          </button>
        </form>
      </section>
    </main>
  )
}
