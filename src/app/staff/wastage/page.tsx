import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function WastageListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()
  const { data: items } = await admin
    .from('stock_items')
    .select('id, name, category, unit')
    .eq('active', true)
    .order('category')
    .order('name')

  return (
    <main className="mx-auto max-w-md">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Hub
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Wastage
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Tap an item to log waste. Always log it — the cost helps the manager
        spot patterns.
      </p>

      {params.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {params.notice}
        </p>
      )}
      {params.error && (
        <p className="mt-4 rounded border border-brand-amber/50 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {params.error}
        </p>
      )}

      <ul className="mt-6 space-y-2">
        {(items ?? []).length === 0 && (
          <li className="rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
            No stock items configured yet.
          </li>
        )}
        {(items ?? []).map((it) => (
          <li key={it.id}>
            <Link
              href={`/staff/wastage/${it.id}`}
              className="block rounded-2xl border border-brand-sage/40 bg-white p-4 transition active:scale-[0.98] hover:border-brand-teal/60 hover:bg-brand-teal/5"
            >
              <p className="font-medium text-brand-forest">{it.name}</p>
              <p className="mt-0.5 text-xs text-brand-slate">
                {it.category ?? '—'} · per {it.unit}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
