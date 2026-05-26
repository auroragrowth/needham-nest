import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function SuppliersListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('suppliers')
    .select('id, name, contact_name, email, phone, delivery_days, payment_terms, active')
    .order('active', { ascending: false })
    .order('name')

  return (
    <main className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Suppliers
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Vendors you order stock from. Used by deliveries / GRN.
          </p>
        </div>
        <Link
          href="/owner/suppliers/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add supplier
        </Link>
      </div>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-brand-sage/40 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-brand-sage/10 text-left text-xs font-semibold uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Delivery days</th>
              <th className="px-4 py-3">Terms</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {s.name}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {s.contact_name ?? '—'}
                  {s.email && (
                    <p className="text-brand-slate/80">{s.email}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {(s.delivery_days ?? []).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {s.payment_terms ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/suppliers/${s.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
