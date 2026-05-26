import Link from 'next/link'
import { createCustomer } from '@/lib/finance/invoice-actions'

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/customers"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Customers
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add customer
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <form
        action={createCustomer}
        className="mt-6 space-y-4 rounded-xl border border-brand-sage/40 bg-white p-6"
      >
        {[
          { name: 'name', label: 'Name', required: true },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'address', label: 'Address' },
          { name: 'city', label: 'City' },
          { name: 'postcode', label: 'Postcode' },
          { name: 'notes', label: 'Notes' },
        ].map((f) => (
          <div key={f.name}>
            <label
              htmlFor={f.name}
              className="block text-sm font-medium text-brand-forest"
            >
              {f.label}
              {f.required && <span className="ml-1 text-brand-amber">*</span>}
            </label>
            <input
              id={f.name}
              name={f.name}
              type={f.type ?? 'text'}
              required={f.required}
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </div>
        ))}

        <button
          type="submit"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          Add customer
        </button>
      </form>
    </main>
  )
}
