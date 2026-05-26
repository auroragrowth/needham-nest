import Link from 'next/link'
import { createItem } from '@/lib/stock/actions'
import { StockForm } from '../form'

export default async function NewStockItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  return (
    <main className="mx-auto max-w-md">
      <Link
        href="/owner/stock"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Stock items
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add stock item
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <StockForm action={createItem} submitLabel="Add item" />
    </main>
  )
}
