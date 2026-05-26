import Link from 'next/link'
import { createSupplier } from '@/lib/suppliers/actions'
import { SupplierForm } from '../form'

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/suppliers"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Suppliers
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add supplier
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <SupplierForm action={createSupplier} submitLabel="Add supplier" />
    </main>
  )
}
