import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  addShoppingItem,
  clearDoneShoppingItems,
  deleteShoppingItem,
  toggleShoppingItem,
} from '@/lib/shopping-list/actions'

type Row = {
  id: string
  item: string
  notes: string | null
  added_by: string | null
  added_at: string
  done: boolean
  done_by: string | null
  done_at: string | null
}

export default async function ShoppingListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const [{ data: rows }, { data: people }] = await Promise.all([
    admin
      .from('shopping_list')
      .select('id, item, notes, added_by, added_at, done, done_by, done_at')
      .order('done')
      .order('added_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ])

  const nameById = new Map((people ?? []).map((p) => [p.id, p.name]))
  const open = (rows ?? []).filter((r) => !r.done) as Row[]
  const done = (rows ?? []).filter((r) => r.done) as Row[]

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link
        href="/"
        className="text-sm text-brand-amber hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Shopping list
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Everyone can add items. Tap the circle to tick something off once
        it&apos;s in.
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

      <form
        action={addShoppingItem}
        className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4"
      >
        <label
          htmlFor="item"
          className="block text-sm font-medium text-brand-forest"
        >
          Add an item
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="item"
            name="item"
            type="text"
            required
            autoComplete="off"
            placeholder="e.g. semi-skimmed milk"
            className="flex-1 rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          />
          <button
            type="submit"
            className="rounded-md bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Add
          </button>
        </div>
      </form>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
        To buy ({open.length})
      </h2>
      <ul className="mt-2 space-y-2">
        {open.length === 0 && (
          <li className="rounded-xl border border-brand-sage/40 bg-white p-4 text-center text-sm text-brand-slate">
            Nothing to buy.
          </li>
        )}
        {open.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-xl border border-brand-sage/40 bg-white p-3"
          >
            <form action={toggleShoppingItem.bind(null, r.id, true)}>
              <button
                type="submit"
                aria-label="Mark as bought"
                title="Tap once it's bought"
                className="h-7 w-7 rounded-full border-2 border-brand-sage/60 hover:border-brand-teal-deep"
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              />
            </form>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-brand-forest">
                {r.item}
              </p>
              <p className="text-xs text-brand-slate">
                Added by {nameById.get(r.added_by ?? '') ?? '—'}
              </p>
            </div>
            <form action={deleteShoppingItem.bind(null, r.id)}>
              <button
                type="submit"
                aria-label="Remove"
                className="text-xs text-brand-amber hover:underline"
              >
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
              Bought ({done.length})
            </h2>
            <form action={clearDoneShoppingItems}>
              <button
                type="submit"
                className="text-xs text-brand-amber hover:underline"
              >
                Clear all bought
              </button>
            </form>
          </div>
          <ul className="mt-2 space-y-2">
            {done.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-brand-sage/30 bg-brand-sage/5 p-3 opacity-80"
              >
                <form action={toggleShoppingItem.bind(null, r.id, false)}>
                  <button
                    type="submit"
                    aria-label="Mark as not bought"
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand-teal-deep bg-brand-teal-deep text-brand-cream"
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    ✓
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-brand-forest line-through">
                    {r.item}
                  </p>
                  <p className="text-xs text-brand-slate">
                    Bought by {nameById.get(r.done_by ?? '') ?? '—'}
                    {r.done_at && (
                      <>
                        {' · '}
                        {new Date(r.done_at).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </>
                    )}
                  </p>
                </div>
                <form action={deleteShoppingItem.bind(null, r.id)}>
                  <button
                    type="submit"
                    aria-label="Remove"
                    className="text-xs text-brand-amber hover:underline"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
