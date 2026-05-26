import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateSupplier } from '@/lib/suppliers/actions'
import { SupplierForm } from '../form'

export default async function EditSupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = createAdminClient()
  const { data: s } = await admin
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!s) notFound()

  const { data: recent } = await admin
    .from('deliveries')
    .select('id, date, total, reference')
    .eq('supplier_id', id)
    .order('date', { ascending: false })
    .limit(10)

  const action = updateSupplier.bind(null, id)

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href="/owner/suppliers"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Suppliers
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        {s.name}
      </h1>

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

      <SupplierForm
        action={action}
        defaults={s}
        submitLabel="Save changes"
      />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        Recent deliveries
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(recent ?? []).map((d) => (
              <tr key={d.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 text-brand-forest">
                  {new Date(d.date).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {d.reference ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-brand-forest">
                  £{Number(d.total).toFixed(2)}
                </td>
              </tr>
            ))}
            {(recent?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No deliveries recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
