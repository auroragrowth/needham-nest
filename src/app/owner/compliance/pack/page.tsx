import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import { PrintButton } from './PrintButton'
import './print.css'

const KIND_LABEL: Record<string, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  hot_hold: 'Hot hold',
  cold_display: 'Cold display',
  ambient: 'Ambient',
}

const FREQ_LABEL: Record<string, string> = {
  open: 'Opening',
  mid: 'Mid-shift',
  close: 'Closing',
  daily: 'Daily',
}

const REASON_LABEL: Record<string, string> = {
  out_of_date: 'Out of date',
  damaged: 'Damaged',
  dropped: 'Dropped',
  customer_return: 'Customer return',
  spillage: 'Spillage',
  mistake: 'Mistake',
  other: 'Other',
}

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}
function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function CompliancePackPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session || (session.role !== 'owner' && session.role !== 'manager')) {
    redirect('/login')
  }

  const from = sp.from || defaultFrom()
  const to = sp.to || defaultTo()
  const fromIso = `${from}T00:00:00Z`
  const toExclusive = new Date(to)
  toExclusive.setDate(toExclusive.getDate() + 1)
  const toIso = toExclusive.toISOString()

  const admin = createAdminClient()

  const [
    { data: settings },
    { data: appliances },
    { data: tempLogs },
    { data: tasks },
    { data: cleanLogs },
    { data: wastage },
    { data: stockItems },
    { data: staff },
    { data: training },
    { data: riskAssessments },
    { data: accidents },
    { data: pestVisits },
  ] = await Promise.all([
    session.authUserId
      ? admin
          .from('settings')
          .select('*')
          .eq('user_id', session.authUserId)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: null }),
    admin
      .from('appliances')
      .select('id, name, kind, target_min, target_max, location, active')
      .order('kind')
      .order('name'),
    admin
      .from('temperature_logs')
      .select('id, appliance_id, user_id, temperature, in_range, recorded_at, corrective_action, notes')
      .gte('recorded_at', fromIso)
      .lt('recorded_at', toIso)
      .order('recorded_at', { ascending: false }),
    admin
      .from('cleaning_tasks')
      .select('id, name, frequency, area, active'),
    admin
      .from('cleaning_log')
      .select('id, task_id, user_id, completed_at')
      .gte('completed_at', fromIso)
      .lt('completed_at', toIso)
      .order('completed_at', { ascending: false }),
    admin
      .from('stock_movements')
      .select('id, stock_item_id, user_id, date, quantity, unit_cost, wastage_reason, notes')
      .not('wastage_reason', 'is', null)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
    admin
      .from('stock_items')
      .select('id, name, allergens')
      .eq('active', true)
      .order('name'),
    admin.from('profiles').select('id, name'),
    admin
      .from('training_records')
      .select('id, user_id, type, certificate_ref, issued_at, expires_at, notes'),
    admin
      .from('risk_assessments')
      .select('id, title, reviewed_at, next_review_at, notes')
      .order('next_review_at', { ascending: true, nullsFirst: false }),
    admin
      .from('accident_log')
      .select('id, occurred_at, person, description, action_taken, riddor_reportable')
      .gte('occurred_at', fromIso)
      .lt('occurred_at', toIso)
      .order('occurred_at', { ascending: false }),
    admin
      .from('pest_control_visits')
      .select('id, date, company, inspector, findings, actions')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
  ])

  const applianceById = new Map((appliances ?? []).map((a) => [a.id, a]))
  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]))
  const itemById = new Map((stockItems ?? []).map((i) => [i.id, i]))
  const staffById = new Map((staff ?? []).map((p) => [p.id, p.name]))

  const tempsTotal = tempLogs?.length ?? 0
  const tempsOutOfRange = (tempLogs ?? []).filter((l) => !l.in_range).length
  const tempsInRangePct =
    tempsTotal === 0
      ? '—'
      : `${Math.round(((tempsTotal - tempsOutOfRange) / tempsTotal) * 100)}%`

  const totalWastageCost = (wastage ?? []).reduce(
    (a, r) =>
      a + (Number(r.unit_cost ?? 0) || 0) * (Number(r.quantity ?? 0) || 0),
    0,
  )

  const companyName = settings?.company_name ?? 'Needham Nest Café'
  const generatedAt = new Date().toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const itemsWithAllergens = (stockItems ?? []).filter(
    (i) => Array.isArray(i.allergens) && i.allergens.length > 0,
  )

  return (
    <div className="pack mx-auto max-w-4xl bg-white p-6 text-sm text-black print:max-w-none">
      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-lg border border-brand-sage/40 bg-brand-cream p-4">
        <div>
          <Link
            href="/owner"
            className="text-sm text-brand-amber hover:underline"
          >
            ← Back to dashboard
          </Link>
          <p className="mt-1 text-sm text-brand-slate">
            Date range:{' '}
            <strong className="text-brand-forest">
              {from} → {to}
            </strong>
            . Use the form below to change it, then print.
          </p>
          <form className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-brand-slate">From</label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="rounded border border-brand-sage/60 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-slate">To</label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="rounded border border-brand-sage/60 px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-brand-forest px-3 py-1.5 text-sm font-medium text-brand-forest hover:bg-brand-forest hover:text-brand-cream"
            >
              Update
            </button>
          </form>
        </div>
        <PrintButton />
      </div>

      {/* COVER */}
      <section className="pack-section border-b border-black/20 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-black/70">
          Compliance pack
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{companyName}</h1>
        <p className="mt-1 text-sm">
          {settings?.company_address ?? ''}
          {settings?.company_number ? ` · Company no. ${settings.company_number}` : ''}
        </p>
        <p className="mt-3 text-sm">
          <strong>Period:</strong> {from} to {to}
        </p>
        <p className="text-xs text-black/60">Generated {generatedAt}</p>
      </section>

      {/* Summary */}
      <section className="pack-section mt-6">
        <h2 className="text-lg font-semibold">Summary</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            <SummaryRow
              label="Temperature logs in period"
              value={`${tempsTotal} (in range ${tempsInRangePct}, ${tempsOutOfRange} out of range)`}
            />
            <SummaryRow
              label="Active appliances monitored"
              value={`${(appliances ?? []).filter((a) => a.active).length}`}
            />
            <SummaryRow
              label="Active checklist tasks"
              value={`${(tasks ?? []).filter((t) => t.active).length}`}
            />
            <SummaryRow
              label="Checklist completions in period"
              value={`${cleanLogs?.length ?? 0}`}
            />
            <SummaryRow
              label="Wastage entries in period"
              value={`${wastage?.length ?? 0} (£${totalWastageCost.toFixed(2)} total)`}
            />
          </tbody>
        </table>
      </section>

      {/* Temperatures */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Temperature records</h2>
        <p className="mt-1 text-xs text-black/60">
          Records of fridge / freezer / hot-hold readings with the appliance
          target range at log time and any corrective action.
        </p>

        <table className="mt-3 w-full border-collapse text-xs">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="border border-black/20 px-2 py-1">When</th>
              <th className="border border-black/20 px-2 py-1">Appliance</th>
              <th className="border border-black/20 px-2 py-1">Target</th>
              <th className="border border-black/20 px-2 py-1">Reading</th>
              <th className="border border-black/20 px-2 py-1">In range</th>
              <th className="border border-black/20 px-2 py-1">Operator</th>
              <th className="border border-black/20 px-2 py-1">Corrective action</th>
            </tr>
          </thead>
          <tbody>
            {(tempLogs ?? []).map((l) => {
              const a = applianceById.get(l.appliance_id)
              return (
                <tr key={l.id}>
                  <td className="border border-black/20 px-2 py-1">
                    {new Date(l.recorded_at).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {a?.name ?? '—'}
                    <span className="text-black/50">
                      {a ? ` (${KIND_LABEL[a.kind] ?? a.kind})` : ''}
                    </span>
                  </td>
                  <td className="border border-black/20 px-2 py-1 font-mono">
                    {a?.target_min != null && a?.target_max != null
                      ? `${a.target_min}–${a.target_max}°C`
                      : a?.target_max != null
                        ? `≤ ${a.target_max}°C`
                        : a?.target_min != null
                          ? `≥ ${a.target_min}°C`
                          : '—'}
                  </td>
                  <td className="border border-black/20 px-2 py-1 font-mono">
                    {l.temperature}°C
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {l.in_range ? '✓' : '✗'}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {staffById.get(l.user_id) ?? '—'}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {l.corrective_action ?? ''}
                  </td>
                </tr>
              )
            })}
            {(tempLogs?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-center text-black/50">
                  No temperature logs in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Cleaning */}
      <section className="pack-section mt-8 pack-page-break">
        <h2 className="text-lg font-semibold">Cleaning &amp; checklist records</h2>
        <p className="mt-1 text-xs text-black/60">
          Tasks configured and completion log for the period.
        </p>

        <h3 className="mt-3 text-sm font-semibold">Active tasks</h3>
        <ul className="ml-5 mt-1 list-disc text-xs">
          {(tasks ?? [])
            .filter((t) => t.active)
            .map((t) => (
              <li key={t.id}>
                {t.name} — {FREQ_LABEL[t.frequency] ?? t.frequency}
                {t.area ? ` (${t.area})` : ''}
              </li>
            ))}
          {(tasks ?? []).filter((t) => t.active).length === 0 && (
            <li className="text-black/50">No active tasks configured.</li>
          )}
        </ul>

        <h3 className="mt-4 text-sm font-semibold">Completion log</h3>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="border border-black/20 px-2 py-1">When</th>
              <th className="border border-black/20 px-2 py-1">Task</th>
              <th className="border border-black/20 px-2 py-1">Frequency</th>
              <th className="border border-black/20 px-2 py-1">Operator</th>
            </tr>
          </thead>
          <tbody>
            {(cleanLogs ?? []).map((l) => {
              const t = taskById.get(l.task_id)
              return (
                <tr key={l.id}>
                  <td className="border border-black/20 px-2 py-1">
                    {new Date(l.completed_at).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {t?.name ?? '—'}
                    {t?.area ? ` (${t.area})` : ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {t ? FREQ_LABEL[t.frequency] ?? t.frequency : '—'}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {staffById.get(l.user_id) ?? '—'}
                  </td>
                </tr>
              )
            })}
            {(cleanLogs?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={4} className="px-2 py-3 text-center text-black/50">
                  No checklist completions in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Wastage */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Wastage record</h2>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead className="bg-black/5 text-left">
            <tr>
              <th className="border border-black/20 px-2 py-1">Date</th>
              <th className="border border-black/20 px-2 py-1">Item</th>
              <th className="border border-black/20 px-2 py-1">Qty</th>
              <th className="border border-black/20 px-2 py-1">Cost</th>
              <th className="border border-black/20 px-2 py-1">Reason</th>
              <th className="border border-black/20 px-2 py-1">Operator</th>
              <th className="border border-black/20 px-2 py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {(wastage ?? []).map((r) => {
              const it = itemById.get(r.stock_item_id)
              const cost =
                (Number(r.unit_cost ?? 0) || 0) * Number(r.quantity ?? 0)
              return (
                <tr key={r.id}>
                  <td className="border border-black/20 px-2 py-1">{r.date}</td>
                  <td className="border border-black/20 px-2 py-1">
                    {it?.name ?? '—'}
                  </td>
                  <td className="border border-black/20 px-2 py-1 font-mono">
                    {r.quantity}
                  </td>
                  <td className="border border-black/20 px-2 py-1 font-mono">
                    £{cost.toFixed(2)}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {REASON_LABEL[r.wastage_reason as string] ?? r.wastage_reason}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {staffById.get(r.user_id) ?? '—'}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {r.notes ?? ''}
                  </td>
                </tr>
              )
            })}
            {(wastage?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-center text-black/50">
                  No wastage in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Allergen summary (placeholder until Phase 3 menus) */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Allergen information</h2>
        {itemsWithAllergens.length === 0 ? (
          <p className="mt-2 text-xs text-black/60">
            No items have allergens recorded. Full allergen matrix lands when
            menu items and recipes are configured (Phase 3 — Sales &amp; Stock).
          </p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="border border-black/20 px-2 py-1">Item</th>
                <th className="border border-black/20 px-2 py-1">Allergens</th>
              </tr>
            </thead>
            <tbody>
              {itemsWithAllergens.map((i) => (
                <tr key={i.id}>
                  <td className="border border-black/20 px-2 py-1">{i.name}</td>
                  <td className="border border-black/20 px-2 py-1">
                    {(i.allergens ?? []).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Training records */}
      <section className="pack-section mt-8 pack-page-break">
        <h2 className="text-lg font-semibold">Training records</h2>
        {(training?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-black/60">
            No training records on file.
          </p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="border border-black/20 px-2 py-1">Staff</th>
                <th className="border border-black/20 px-2 py-1">Course</th>
                <th className="border border-black/20 px-2 py-1">Cert ref</th>
                <th className="border border-black/20 px-2 py-1">Issued</th>
                <th className="border border-black/20 px-2 py-1">Expires</th>
                <th className="border border-black/20 px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {(training ?? []).map((t) => {
                const expired = t.expires_at
                  ? new Date(t.expires_at) < new Date()
                  : false
                return (
                  <tr key={t.id}>
                    <td className="border border-black/20 px-2 py-1">
                      {staffById.get(t.user_id) ?? '—'}
                    </td>
                    <td className="border border-black/20 px-2 py-1">
                      {t.type}
                    </td>
                    <td className="border border-black/20 px-2 py-1">
                      {t.certificate_ref ?? ''}
                    </td>
                    <td className="border border-black/20 px-2 py-1">
                      {t.issued_at ?? ''}
                    </td>
                    <td className="border border-black/20 px-2 py-1">
                      {t.expires_at ?? ''}
                    </td>
                    <td className="border border-black/20 px-2 py-1">
                      {expired ? 'EXPIRED' : 'Valid'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Risk assessments */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Risk assessments</h2>
        {(riskAssessments?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-black/60">
            No risk assessments on file.
          </p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="border border-black/20 px-2 py-1">Title</th>
                <th className="border border-black/20 px-2 py-1">Reviewed</th>
                <th className="border border-black/20 px-2 py-1">Next review</th>
                <th className="border border-black/20 px-2 py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {(riskAssessments ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="border border-black/20 px-2 py-1">{r.title}</td>
                  <td className="border border-black/20 px-2 py-1">
                    {r.reviewed_at ?? ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {r.next_review_at ?? ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {r.notes ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Accident log */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Accident log</h2>
        {(accidents?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-black/60">
            No accidents recorded in this period.
          </p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="border border-black/20 px-2 py-1">When</th>
                <th className="border border-black/20 px-2 py-1">Person</th>
                <th className="border border-black/20 px-2 py-1">Description</th>
                <th className="border border-black/20 px-2 py-1">Action</th>
                <th className="border border-black/20 px-2 py-1">RIDDOR</th>
              </tr>
            </thead>
            <tbody>
              {(accidents ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="border border-black/20 px-2 py-1">
                    {new Date(a.occurred_at).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="border border-black/20 px-2 py-1">{a.person}</td>
                  <td className="border border-black/20 px-2 py-1">
                    {a.description}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {a.action_taken ?? ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {a.riddor_reportable ? 'YES' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pest control */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Pest control visits</h2>
        {(pestVisits?.length ?? 0) === 0 ? (
          <p className="mt-2 text-xs text-black/60">
            No visits in this period.
          </p>
        ) : (
          <table className="mt-2 w-full border-collapse text-xs">
            <thead className="bg-black/5 text-left">
              <tr>
                <th className="border border-black/20 px-2 py-1">Date</th>
                <th className="border border-black/20 px-2 py-1">Company</th>
                <th className="border border-black/20 px-2 py-1">Inspector</th>
                <th className="border border-black/20 px-2 py-1">Findings</th>
                <th className="border border-black/20 px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(pestVisits ?? []).map((v) => (
                <tr key={v.id}>
                  <td className="border border-black/20 px-2 py-1">{v.date}</td>
                  <td className="border border-black/20 px-2 py-1">
                    {v.company ?? ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {v.inspector ?? ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {v.findings ?? ''}
                  </td>
                  <td className="border border-black/20 px-2 py-1">
                    {v.actions ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Still-pending items */}
      <section className="pack-section mt-8">
        <h2 className="text-lg font-semibold">Still to capture</h2>
        <ul className="ml-5 mt-2 list-disc text-xs text-black/60">
          <li>
            <strong>FHRS rating &amp; last inspection</strong> — record in
            company settings.
          </li>
          <li>
            <strong>HACCP plan attachments</strong> — file uploads land with the
            compliance-docs bucket in a follow-up.
          </li>
        </ul>
      </section>

      <section className="pack-section mt-10 border-t border-black/20 pt-3 text-xs text-black/60">
        End of pack · {companyName} · {from} to {to}
      </section>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="border-b border-black/10 py-1 pr-3 text-black/70">
        {label}
      </td>
      <td className="border-b border-black/10 py-1 font-medium">{value}</td>
    </tr>
  )
}

