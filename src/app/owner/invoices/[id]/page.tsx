import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { markInvoiceStatus } from '@/lib/finance/invoice-actions'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-brand-sage/20 text-brand-forest',
  sent: 'bg-brand-teal/15 text-brand-teal-deep',
  paid: 'bg-brand-teal-deep text-brand-cream',
  overdue: 'bg-brand-amber/30 text-brand-forest',
}

type Item = { description: string; quantity: number; unit_price: number }

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: inv } = await admin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!inv) notFound()

  const customer = (inv.customer_snapshot ?? {}) as {
    name?: string
    email?: string
    address?: string
    city?: string
    postcode?: string
  }
  const items = (inv.items ?? []) as Item[]

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/owner/invoices"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Invoices
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
          {inv.invoice_number}
        </h1>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[inv.status] ?? ''}`}
        >
          {inv.status}
        </span>
      </div>

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

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Customer
          </h2>
          <p className="mt-2 font-medium text-brand-forest">{customer.name}</p>
          {customer.email && (
            <p className="text-sm text-brand-slate">{customer.email}</p>
          )}
          {customer.address && (
            <p className="mt-2 text-sm text-brand-forest">{customer.address}</p>
          )}
          {(customer.city || customer.postcode) && (
            <p className="text-sm text-brand-forest">
              {customer.city ?? ''} {customer.postcode ?? ''}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Dates
          </h2>
          <p className="mt-2 text-sm text-brand-forest">
            Issued:{' '}
            <strong>
              {new Date(inv.date).toLocaleDateString([], {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </strong>
          </p>
          <p className="text-sm text-brand-forest">
            Due:{' '}
            <strong>
              {inv.due_date
                ? new Date(inv.due_date).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </strong>
          </p>
          {inv.paid_at && (
            <p className="text-sm text-brand-teal-deep">
              Paid:{' '}
              {new Date(inv.paid_at).toLocaleDateString([], {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit £</th>
              <th className="px-4 py-3 text-right">Line £</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 text-brand-forest">{it.description}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {it.quantity}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  £{Number(it.unit_price).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  £{(it.quantity * it.unit_price).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-brand-sage/40 bg-brand-cream">
              <td colSpan={3} className="px-4 py-3 text-right text-brand-slate">
                Subtotal
              </td>
              <td className="px-4 py-3 text-right font-mono text-brand-forest">
                £{Number(inv.subtotal).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right text-brand-slate">
                VAT
              </td>
              <td className="px-4 py-3 text-right font-mono text-brand-slate">
                £{Number(inv.vat_amount).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={3}
                className="px-4 py-3 text-right text-base font-semibold text-brand-forest"
              >
                Total
              </td>
              <td className="px-4 py-3 text-right font-mono text-lg font-semibold text-brand-forest">
                £{Number(inv.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {inv.notes && (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Notes
          </h2>
          <p className="mt-2 text-sm text-brand-forest">{inv.notes}</p>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Change status
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusButton id={id} target="draft" current={inv.status} />
          <StatusButton id={id} target="sent" current={inv.status} />
          <StatusButton id={id} target="paid" current={inv.status} />
          <StatusButton id={id} target="overdue" current={inv.status} />
        </div>
      </section>
    </main>
  )
}

function StatusButton({
  id,
  target,
  current,
}: {
  id: string
  target: 'draft' | 'sent' | 'paid' | 'overdue'
  current: string
}) {
  const action = markInvoiceStatus.bind(null, id, target)
  const isCurrent = current === target
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={isCurrent}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
          isCurrent
            ? 'cursor-not-allowed border border-brand-sage/40 bg-brand-sage/10 text-brand-slate'
            : target === 'paid'
              ? 'bg-brand-teal-deep text-brand-cream hover:bg-brand-teal'
              : 'border border-brand-forest text-brand-forest hover:bg-brand-forest hover:text-brand-cream'
        }`}
      >
        Mark as {target}
      </button>
    </form>
  )
}
