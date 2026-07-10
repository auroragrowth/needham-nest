import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  createLocation,
  deactivateLocation,
  reactivateLocation,
} from '@/lib/stock-locations/actions'

export const dynamic = 'force-dynamic'

export default async function ManageLocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>
}) {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')
  const sp = await searchParams

  const admin = createAdminClient()
  const { data: locations } = await admin
    .from('stock_locations')
    .select('id, name, zone, cold_type, active, sort_order')
    .order('active', { ascending: false })
    .order('sort_order')
    .order('name')

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/owner" className="text-sm text-brand-amber hover:underline">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">
        Stock locations
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Every physical spot stock lives — fridges, freezers, dry storage,
        coffee bar. Deactivating a location hides it from staff without
        deleting its history.
      </p>

      {sp.notice && (
        <p className="mt-4 rounded border border-brand-teal/40 bg-brand-teal/10 p-3 text-sm text-brand-teal-deep">
          {sp.notice}
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded border border-brand-amber/60 bg-brand-amber/10 p-3 text-sm text-brand-forest">
          {sp.error}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
          Add a location
        </h2>
        <form action={createLocation} className="mt-3 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-brand-forest">
              Name
            </label>
            <input
              name="name"
              required
              placeholder="e.g. Kitchen counter fridge"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Zone
            </label>
            <select
              name="zone"
              defaultValue="kitchen"
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            >
              <option value="kitchen">Kitchen</option>
              <option value="cafe">Café</option>
              <option value="storage">Storage</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-forest">
              Type
            </label>
            <select
              name="cold_type"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-brand-sage/60 bg-white px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="chilled">Chilled</option>
              <option value="frozen">Frozen</option>
              <option value="ambient">Ambient</option>
            </select>
          </div>
          <div className="sm:col-span-4">
            <button
              type="submit"
              className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-brand-cream hover:bg-brand-olive"
            >
              Add location
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-left font-semibold text-brand-slate">
                Name
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-left font-semibold text-brand-slate">
                Zone
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-left font-semibold text-brand-slate">
                Type
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2 text-left font-semibold text-brand-slate">
                Status
              </th>
              <th className="border-b border-brand-sage/40 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(locations ?? []).map((l) => {
              const deact = deactivateLocation.bind(null, l.id)
              const react = reactivateLocation.bind(null, l.id)
              return (
                <tr key={l.id}>
                  <td className="border-b border-brand-sage/30 px-3 py-2 font-medium text-brand-forest">
                    {l.name}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 capitalize">
                    {l.zone}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 capitalize">
                    {l.cold_type ?? '—'}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2">
                    {l.active ? (
                      <span className="rounded bg-brand-teal-deep/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-teal-deep">
                        active
                      </span>
                    ) : (
                      <span className="rounded bg-brand-sage/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-forest">
                        inactive
                      </span>
                    )}
                  </td>
                  <td className="border-b border-brand-sage/30 px-3 py-2 text-right">
                    {l.active ? (
                      <form action={deact}>
                        <button
                          type="submit"
                          className="rounded border border-brand-amber/60 px-2 py-1 text-xs text-brand-amber hover:bg-brand-amber/10"
                        >
                          Deactivate
                        </button>
                      </form>
                    ) : (
                      <form action={react}>
                        <button
                          type="submit"
                          className="rounded border border-brand-sage/60 px-2 py-1 text-xs text-brand-forest hover:bg-brand-sage/10"
                        >
                          Reactivate
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </main>
  )
}
