import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { COMMON_ALLERGENS } from '@/lib/menu'
import { PrintButton } from '@/components/shared/PrintButton'
import './print.css'

export default async function AllergenSheetPage() {
  const session = await getSession()
  if (!session || (session.role !== 'owner' && session.role !== 'manager')) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const [{ data: items }, { data: settings }] = await Promise.all([
    admin
      .from('menu_items')
      .select('id, name, category, allergens')
      .eq('active', true)
      .order('category')
      .order('name'),
    session.authUserId
      ? admin
          .from('settings')
          .select('company_name')
          .eq('user_id', session.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
  ])

  const companyName = settings?.company_name ?? 'Needham Nest Café'
  const today = new Date().toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="pack mx-auto max-w-6xl bg-white p-6 text-sm text-black print:max-w-none">
      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-lg border border-brand-sage/40 bg-brand-cream p-4">
        <div>
          <Link
            href="/owner"
            className="text-sm text-brand-amber hover:underline"
          >
            ← Back to dashboard
          </Link>
          <p className="mt-1 text-sm text-brand-slate">
            Print this and keep it visible at the pass. Required by UK food
            law (Natasha&apos;s Law for PPDS items).
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/owner/allergen-sheet/pdf"
            download
            className="rounded-lg bg-brand-teal px-3 py-1.5 text-sm font-semibold text-brand-cream hover:bg-brand-teal-deep"
          >
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <section className="border-b border-black/20 pb-3">
        <p className="text-xs uppercase tracking-[0.2em] text-black/70">
          Allergen information
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{companyName}</h1>
        <p className="mt-1 text-xs text-black/60">Issued {today}</p>
      </section>

      {(items?.length ?? 0) === 0 ? (
        <p className="mt-6 rounded border border-black/20 p-5 text-center text-sm">
          No menu items configured.
        </p>
      ) : (
        <table className="mt-4 w-full border-collapse text-xs">
          <thead className="bg-black/5">
            <tr>
              <th className="border border-black/20 px-2 py-2 text-left">Item</th>
              {COMMON_ALLERGENS.map((a) => (
                <th
                  key={a}
                  className="border border-black/20 px-1 py-2 text-center capitalize"
                  style={{ writingMode: 'vertical-rl', minWidth: '22px' }}
                >
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => {
              const has = new Set((it.allergens ?? []) as string[])
              return (
                <tr key={it.id}>
                  <td className="border border-black/20 px-2 py-1">
                    <span className="font-medium">{it.name}</span>
                    {it.category && (
                      <span className="ml-2 text-black/50">{it.category}</span>
                    )}
                  </td>
                  {COMMON_ALLERGENS.map((a) => (
                    <td
                      key={a}
                      className={`border border-black/20 px-1 py-1 text-center ${has.has(a) ? 'bg-black/80 text-white' : ''}`}
                    >
                      {has.has(a) ? '●' : ''}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-xs text-black/60">
        ● indicates the allergen is present. Always check with the customer
        if unsure — recipes change.
      </p>
    </div>
  )
}
