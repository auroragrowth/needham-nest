import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMenuItem } from '@/lib/menu/actions'
import { MenuItemForm } from '../form'

export default async function NewMenuItemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: stock } = await admin
    .from('stock_items')
    .select('id, name, unit')
    .eq('active', true)
    .order('name')

  return (
    <main className="mx-auto max-w-2xl">
      <Link
        href="/owner/menu"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Menu
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Add menu item
      </h1>

      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <MenuItemForm
        action={createMenuItem}
        stockOptions={stock ?? []}
        submitLabel="Add item"
      />
    </main>
  )
}
