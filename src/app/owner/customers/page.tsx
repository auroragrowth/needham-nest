import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: customers } = await admin
    .from('customers')
    .select('id, name, email, city, active')
    .order('name')

  return (
    <main className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Customers
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            For occasional B2B catering / functions.
          </p>
        </div>
        <Link
          href="/owner/customers/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add customer
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
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">City</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-t border-brand-sage/30">
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {c.email ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {c.city ?? '—'}
                </td>
              </tr>
            ))}
            {(customers?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
