import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const KIND_LABEL: Record<string, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  hot_hold: 'Hot hold',
  cold_display: 'Cold display',
  ambient: 'Ambient',
}

function formatTarget(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min}°C – ${max}°C`
  if (max != null) return `≤ ${max}°C`
  if (min != null) return `≥ ${min}°C`
  return '—'
}

export default async function AppliancesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const params = await searchParams
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('appliances')
    .select('id, name, kind, target_min, target_max, location, active')
    .order('active', { ascending: false })
    .order('kind')
    .order('name')

  return (
    <main className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
            Appliances
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Fridges, freezers, hot-holds. Staff log temperatures against these.
          </p>
        </div>
        <Link
          href="/owner/appliances/new"
          className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive"
        >
          + Add appliance
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
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((a) => (
              <tr
                key={a.id}
                className={`border-t border-brand-sage/30 ${
                  a.active ? '' : 'text-brand-slate'
                }`}
              >
                <td className="px-4 py-3 font-medium text-brand-forest">
                  {a.name}
                </td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide">
                  {KIND_LABEL[a.kind] ?? a.kind}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {formatTarget(a.target_min, a.target_max)}
                </td>
                <td className="px-4 py-3 text-xs text-brand-slate">
                  {a.location ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {a.active ? (
                    <span className="text-brand-teal-deep">Active</span>
                  ) : (
                    <span className="text-brand-slate">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/appliances/${a.id}`}
                    className="text-sm font-medium text-brand-amber hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {(rows?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-slate"
                >
                  No appliances yet. Add at least one fridge / freezer /
                  hot-hold so staff can log temperatures.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
