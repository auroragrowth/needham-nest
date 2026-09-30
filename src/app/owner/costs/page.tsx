import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import {
  costProposals,
  costsActivity,
  costsSummary,
  mapQueue,
  type CostsSummary,
  type MapGroup,
  type Named,
  type Proposal,
} from '@/lib/invoice-capture/costs'
import { decideAction, mapAction } from '@/lib/invoice-capture/cost-actions'

export const dynamic = 'force-dynamic'

type Tab = 'approve' | 'map' | 'activity'

/** 245 → "£2.45", 0.83 → "0.83p", as the till's own log writes them. */
function pence(n: number | null | undefined): string {
  if (n == null) return '–'
  return n >= 100 ? `£${(n / 100).toFixed(2)}` : `${Number(n.toFixed(2))}p`
}

function day(d: string | null | undefined): string {
  if (!d) return '–'
  return new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: Tab; notice?: string }>
}) {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')
  const sp = await searchParams
  const tab: Tab = sp.tab === 'map' || sp.tab === 'activity' ? sp.tab : 'approve'

  let summary: CostsSummary | null = null
  let failure: string | null = null
  try {
    summary = await costsSummary()
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e)
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'approve', label: `Costs to approve${summary ? ` (${summary.proposed})` : ''}` },
    { id: 'map', label: `Lines to map${summary ? ` (${summary.to_map})` : ''}` },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <main className="mx-auto max-w-5xl pb-16">
      <Link href="/owner" className="text-sm text-brand-slate">← Owner</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">Ingredient costs</h1>
      <p className="mt-1 text-sm text-brand-slate">
        Every invoice photographed is read line by line. A price becomes the cost of an ingredient only when you approve
        it here, and then Insights can show what each item costs to make.
        {summary && summary.backlog > 0 && ` ${summary.backlog} invoices still to read; it works through them every 15 minutes.`}
      </p>

      {sp.notice && (
        <p className="mt-4 rounded-xl border border-brand-teal bg-white p-3 text-sm text-brand-forest">{sp.notice}</p>
      )}
      {failure && (
        <p className="mt-4 rounded-xl border border-brand-amber bg-white p-3 text-sm text-brand-forest">
          Could not reach the till: {failure}
        </p>
      )}

      <nav className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/owner/costs?tab=${t.id}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              t.id === tab ? 'border-brand-forest bg-brand-forest text-white' : 'border-brand-sage bg-white text-brand-forest'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {!failure && tab === 'approve' && <Approve />}
      {!failure && tab === 'map' && <MapLines />}
      {!failure && tab === 'activity' && <Activity />}
    </main>
  )
}

/* Costs to approve ----------------------------------------------------------- */

async function Approve() {
  const { proposals } = await costProposals()
  if (!proposals.length) {
    return (
      <p className="mt-6 rounded-2xl border border-brand-sage bg-white p-5 text-sm text-brand-forest">
        Nothing waiting. New costs appear here as invoices are read and their lines are mapped.
      </p>
    )
  }
  return (
    <form action={decideAction} className="mt-6">
      <p className="mb-3 text-sm text-brand-slate">
        Check the pack size and price against the photo, tick the ones that are right, then approve. Moves of 10% or more
        are at the top, because a menu price may need a look.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-brand-sage bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-brand-slate">
            <tr>
              <th className="p-3" />
              <th className="p-3">Ingredient</th>
              <th className="p-3">From the invoice</th>
              <th className="p-3 text-right">Pack</th>
              <th className="p-3 text-right">Cost per unit</th>
              <th className="p-3 text-right">Change</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {proposals.map((p) => (
              <ProposalRow key={p.id} p={p} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button name="decision" value="approved" className="rounded-xl bg-brand-forest px-5 py-3 text-sm font-semibold text-white">
          Approve ticked
        </button>
        <button name="decision" value="rejected" className="rounded-xl border border-brand-sage bg-white px-5 py-3 text-sm font-semibold text-brand-forest">
          Reject ticked
        </button>
      </div>
    </form>
  )
}

function ProposalRow({ p }: { p: Proposal }) {
  const what = p.ingredient ?? p.supply
  const unit = what?.unit || 'each'
  const inv = p.line?.invoice
  return (
    <tr className="border-t border-brand-cream align-top">
      <td className="p-3">
        <input type="checkbox" name="ids" value={p.id} className="h-5 w-5" />
      </td>
      <td className="p-3">
        <div className="font-medium text-brand-forest">{what?.name ?? '–'}</div>
        <div className="text-xs text-brand-slate">{p.supply ? 'Supply' : 'Ingredient'}, per {unit}</div>
      </td>
      <td className="p-3 text-brand-forest">
        <div>{p.line?.description_raw ?? '–'}</div>
        <div className="text-xs text-brand-slate">
          {[inv?.supplier?.name, inv?.invoice_no, day(p.effective_from)].filter(Boolean).join(' · ')}
        </div>
      </td>
      <td className="p-3 text-right text-brand-forest">
        <div>{pence(p.line?.pack_price)}</div>
        <div className="text-xs text-brand-slate">
          {p.line?.pack_size_qty ?? '?'} {p.line?.pack_size_unit ?? unit}
        </div>
      </td>
      <td className="p-3 text-right font-semibold text-brand-forest">{pence(p.unit_cost)}</td>
      <td className="p-3 text-right">
        {p.change_pct == null ? (
          <span className="text-xs text-brand-slate">first cost</span>
        ) : (
          <span style={{ color: p.big_move ? '#b4533a' : '#17443f' }} className="font-medium">
            {p.change_pct >= 0 ? '+' : ''}
            {p.change_pct}%
          </span>
        )}
      </td>
      <td className="p-3">
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-teal-deep underline">
            Photo
          </a>
        )}
      </td>
    </tr>
  )
}

/* Lines to map ---------------------------------------------------------------- */

async function MapLines() {
  const { groups, ingredients, supplies } = await mapQueue()
  if (!groups.length) {
    return (
      <p className="mt-6 rounded-2xl border border-brand-sage bg-white p-5 text-sm text-brand-forest">
        Every line read so far is mapped. New ones appear here the first time a supplier sends something we haven&rsquo;t
        seen before.
      </p>
    )
  }
  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-brand-slate">
        Say once what each line is and how much is in one pack, in the ingredient&rsquo;s own unit. After that the same line
        from the same supplier is matched by itself. Most bought on the most invoices are first within each supplier.
      </p>
      {groups.map((g) => (
        <MapRow key={`${g.supplier_id}-${g.description}`} g={g} ingredients={ingredients} supplies={supplies} />
      ))}
    </div>
  )
}

function MapRow({ g, ingredients, supplies }: { g: MapGroup; ingredients: Named[]; supplies: Named[] }) {
  return (
    <form action={mapAction} className="rounded-2xl border border-brand-sage bg-white p-4">
      <input type="hidden" name="supplier_id" value={g.supplier_id ?? ''} />
      <input type="hidden" name="description" value={g.description} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-brand-forest">{g.description}</div>
          <div className="text-xs text-brand-slate">
            {g.supplier ?? 'No supplier'} · on {g.count} {g.count === 1 ? 'invoice line' : 'invoice lines'} · latest{' '}
            {day(g.latest.date)}: {pence(g.latest.pack_price)}
            {g.latest.pack_raw ? ` for ${g.latest.pack_raw}` : ''}
          </div>
        </div>
        {g.latest.url && (
          <a href={g.latest.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-teal-deep underline">
            Photo
          </a>
        )}
      </div>
      {g.supplier_id ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-brand-slate">
            It is
            <select name="target" defaultValue="" className="mt-1 block max-w-xs rounded-lg border border-brand-sage bg-white px-2 py-2 text-sm text-brand-forest">
              <option value="">Choose…</option>
              <optgroup label="Ingredients">
                {ingredients.map((i) => (
                  <option key={i.id} value={`ingredient:${i.id}`}>
                    {i.name} (per {i.unit ?? 'each'})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Supplies">
                {supplies.map((s) => (
                  <option key={s.id} value={`supply:${s.id}`}>
                    {s.name} (per {s.unit || 'each'})
                  </option>
                ))}
              </optgroup>
              <option value="ignore">Not stock (ignore this line)</option>
            </select>
          </label>
          <label className="text-xs text-brand-slate">
            Units in one pack
            <input
              type="number"
              name="pack_size_qty"
              step="any"
              min="0"
              defaultValue={g.latest.pack_size_qty ?? ''}
              className="mt-1 block w-32 rounded-lg border border-brand-sage bg-white px-2 py-2 text-sm text-brand-forest"
            />
          </label>
          <span className="pb-2 text-xs text-brand-slate">
            {g.latest.pack_size_unit ? `read as ${g.latest.pack_size_qty ?? '?'} ${g.latest.pack_size_unit}` : 'pack size not read'}
          </span>
          <button className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-medium text-white">Save</button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-brand-slate">
          This invoice has no supplier on it, so it can&rsquo;t be mapped until one is set.
        </p>
      )}
    </form>
  )
}

/* Activity ---------------------------------------------------------------------- */

async function Activity() {
  const { activity } = await costsActivity()
  if (!activity.length) {
    return <p className="mt-6 rounded-2xl border border-brand-sage bg-white p-5 text-sm text-brand-forest">Nothing yet.</p>
  }
  return (
    <ul className="mt-6 divide-y divide-brand-cream rounded-2xl border border-brand-sage bg-white">
      {activity.map((a) => (
        <li key={a.id} className="p-4 text-sm text-brand-forest">
          <div>{a.message}</div>
          <div className="mt-1 text-xs text-brand-slate">
            {new Date(a.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </li>
      ))}
    </ul>
  )
}
