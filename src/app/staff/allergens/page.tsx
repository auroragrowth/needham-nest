import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { COMMON_ALLERGENS } from '@/lib/menu'

export const dynamic = 'force-dynamic'

// Each of the 14 UK statutory allergens gets a colour + emoji so staff
// can scan a card and spot the relevant warning instantly. Colour
// choices stay readable against the cream background.
const ALLERGEN_META: Record<
  string,
  { label: string; emoji: string; bg: string; text: string }
> = {
  gluten: { label: 'Gluten', emoji: '🌾', bg: '#f4d2a8', text: '#5a3a14' },
  crustaceans: { label: 'Crustaceans', emoji: '🦐', bg: '#f9b3a1', text: '#5c1a10' },
  eggs: { label: 'Eggs', emoji: '🥚', bg: '#fce4a8', text: '#604414' },
  fish: { label: 'Fish', emoji: '🐟', bg: '#a8d4f9', text: '#0e3a5c' },
  peanuts: { label: 'Peanuts', emoji: '🥜', bg: '#e8a87c', text: '#4a2410' },
  soybeans: { label: 'Soya', emoji: '🫘', bg: '#c8e0b4', text: '#2a4a14' },
  milk: { label: 'Milk', emoji: '🥛', bg: '#e8e8f0', text: '#2a2a4a' },
  nuts: { label: 'Tree nuts', emoji: '🌰', bg: '#d4a574', text: '#3a2010' },
  celery: { label: 'Celery', emoji: '🌿', bg: '#c0d9a4', text: '#2a3a14' },
  mustard: { label: 'Mustard', emoji: '🌶️', bg: '#f0d670', text: '#604a14' },
  sesame: { label: 'Sesame', emoji: '🟤', bg: '#d4b890', text: '#3a2a10' },
  sulphites: { label: 'Sulphites', emoji: '⚗️', bg: '#e8c4f0', text: '#3a1a4a' },
  lupin: { label: 'Lupin', emoji: '🌼', bg: '#f4e0a8', text: '#5a4414' },
  molluscs: { label: 'Molluscs', emoji: '🦪', bg: '#b8c4d4', text: '#1a2a3a' },
}

export default async function StaffAllergensPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  const sp = await searchParams
  const q = (sp.q ?? '').trim().toLowerCase()

  const admin = createAdminClient()
  const { data: items } = await admin
    .from('menu_items')
    .select('id, name, category, allergens, description')
    .eq('active', true)
    .order('category')
    .order('name')

  const filtered = q
    ? (items ?? []).filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.allergens ?? []).some((a: string) =>
            a.toLowerCase().includes(q),
          ),
      )
    : (items ?? [])

  // Group by category for browse
  const byCategory = new Map<string, typeof filtered>()
  for (const i of filtered) {
    const c = i.category ?? 'Other'
    const arr = byCategory.get(c) ?? []
    arr.push(i)
    byCategory.set(c, arr)
  }

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/staff" className="text-sm text-brand-amber hover:underline">
        ← Tablet
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Allergens
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        UK law: if a customer asks, you must give the correct allergen
        info. Tap an item to see what&apos;s in it. When in doubt, check
        with the kitchen.
      </p>

      {/* Search */}
      <form className="mt-4">
        <input
          name="q"
          type="search"
          placeholder="Search item or allergen…"
          defaultValue={q}
          className="w-full rounded-lg border border-brand-sage/60 bg-white px-4 py-3 text-base text-brand-forest"
          style={{ minHeight: '44px' }}
        />
      </form>

      {/* Legend */}
      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          The 14 statutory allergens
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMMON_ALLERGENS.map((a) => {
            const m = ALLERGEN_META[a]
            return (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: m.bg, color: m.text }}
              >
                <span aria-hidden>{m.emoji}</span>
                {m.label}
              </span>
            )
          })}
        </div>
      </section>

      {/* Items */}
      {(items?.length ?? 0) === 0 ? (
        <section className="mt-6 rounded-xl border-2 border-brand-amber bg-brand-amber/10 p-5 text-center text-sm text-brand-forest">
          <p className="font-semibold">No menu items yet.</p>
          <p className="mt-2 text-xs text-brand-slate">
            Paul needs to add the menu first under{' '}
            <strong>Owner → Menu</strong>. Once items are in, tap each one
            here to see its allergens.
          </p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5 text-center text-sm text-brand-slate">
          Nothing matches &ldquo;{q}&rdquo;.
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          {Array.from(byCategory.entries()).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
                {cat}
              </h2>
              <ul className="mt-2 space-y-2">
                {list.map((item) => {
                  const allergenList = item.allergens ?? []
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-brand-sage/40 bg-white p-4"
                    >
                      <p className="text-base font-semibold text-brand-forest">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="mt-1 text-xs text-brand-slate">
                          {item.description}
                        </p>
                      )}
                      {allergenList.length === 0 ? (
                        <p className="mt-2 text-xs italic text-brand-slate">
                          No allergens marked — confirm with kitchen.
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {allergenList.map((a: string) => {
                            const m = ALLERGEN_META[a] ?? {
                              label: a,
                              emoji: '⚠️',
                              bg: '#fee',
                              text: '#700',
                            }
                            return (
                              <span
                                key={a}
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold"
                                style={{ backgroundColor: m.bg, color: m.text }}
                              >
                                <span aria-hidden>{m.emoji}</span>
                                {m.label}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-[10px] text-brand-slate">
        Always cross-check with the kitchen for severe allergies, especially
        nut, dairy, gluten and shellfish. Cross-contamination is possible in
        any shared kitchen.
      </p>
    </main>
  )
}
