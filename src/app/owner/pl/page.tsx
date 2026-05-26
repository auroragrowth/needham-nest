import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/auth/session'
import {
  EXPENSE_CATEGORY_LABEL,
  TAKINGS_SOURCE_LABEL,
} from '@/lib/finance/constants'

function startOfMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type Preset = 'mtd' | 'ytd' | 'last_month' | 'custom'

function presetRange(preset: Preset): { from: string; to: string } | null {
  const today = todayIso()
  if (preset === 'mtd') return { from: startOfMonthIso(), to: today }
  if (preset === 'ytd') {
    const d = new Date()
    d.setMonth(0, 1)
    d.setHours(0, 0, 0, 0)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  if (preset === 'last_month') {
    const d = new Date()
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const lastMonthStart = new Date(monthStart)
    lastMonthStart.setMonth(monthStart.getMonth() - 1)
    const lastMonthEnd = new Date(monthStart)
    lastMonthEnd.setDate(monthStart.getDate() - 1)
    return {
      from: lastMonthStart.toISOString().slice(0, 10),
      to: lastMonthEnd.toISOString().slice(0, 10),
    }
  }
  return null
}

export default async function PlPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: Preset }>
}) {
  const sp = await searchParams
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')

  const presetRangeResult = sp.preset ? presetRange(sp.preset) : null
  const from = sp.from || presetRangeResult?.from || startOfMonthIso()
  const to = sp.to || presetRangeResult?.to || todayIso()

  const admin = createAdminClient()

  const [{ data: takings }, { data: expenses }, { data: settings }, { data: pot }] =
    await Promise.all([
      admin
        .from('takings')
        .select('source, amount')
        .gte('date', from)
        .lte('date', to),
      admin
        .from('expenses')
        .select('category, amount')
        .gte('date', from)
        .lte('date', to),
      session.authUserId
        ? admin
            .from('settings')
            .select('ct_rate')
            .eq('user_id', session.authUserId)
            .maybeSingle()
        : Promise.resolve({ data: null } as { data: null }),
      admin
        .from('pot_allocations')
        .select('amount')
        .eq('pot', 'tax')
        .lte('date', to),
    ])

  const totalTakings = (takings ?? []).reduce(
    (a, r) => a + Number(r.amount ?? 0),
    0,
  )
  const totalExpenses = (expenses ?? []).reduce(
    (a, r) => a + Number(r.amount ?? 0),
    0,
  )
  const profit = totalTakings - totalExpenses
  const ctRate = Number(settings?.ct_rate ?? 19) / 100
  const ctEstimate = Math.max(0, profit * ctRate)
  const netAfterCt = profit - ctEstimate
  const potBalance = (pot ?? []).reduce((a, r) => a + Number(r.amount), 0)

  const bySource = new Map<string, number>()
  for (const r of takings ?? []) {
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + Number(r.amount))
  }
  const byCategory = new Map<string, number>()
  for (const r of expenses ?? []) {
    byCategory.set(
      r.category,
      (byCategory.get(r.category) ?? 0) + Number(r.amount),
    )
  }

  return (
    <main className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-forest">
        Profit &amp; Loss
      </h1>
      <p className="mt-1 text-sm text-brand-slate">
        Takings minus expenses for the selected period. Net after CT uses the
        rate from your{' '}
        <Link
          href="/owner/onboarding"
          className="text-brand-amber hover:underline"
        >
          company settings
        </Link>
        .
      </p>

      {/* Period picker */}
      <section className="mt-6 rounded-xl border border-brand-sage/40 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <PresetLink label="Month to date" preset="mtd" />
          <PresetLink label="Last month" preset="last_month" />
          <PresetLink label="Year to date" preset="ytd" />
        </div>
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
            Apply
          </button>
        </form>
        <p className="mt-2 text-xs text-brand-slate">
          {from} → {to}
        </p>
      </section>

      {/* Top stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Takings" value={`£${totalTakings.toFixed(2)}`} tone="teal" />
        <Stat
          label="Expenses"
          value={`£${totalExpenses.toFixed(2)}`}
          tone="amber"
        />
        <Stat
          label="Profit (pre-CT)"
          value={`${profit < 0 ? '-' : ''}£${Math.abs(profit).toFixed(2)}`}
          tone={profit >= 0 ? 'teal' : 'amber'}
        />
        <Stat
          label="Net after CT"
          value={`${netAfterCt < 0 ? '-' : ''}£${Math.abs(netAfterCt).toFixed(2)}`}
          tone={netAfterCt >= 0 ? 'teal' : 'amber'}
        />
      </div>

      <p className="mt-2 text-xs text-brand-slate">
        Estimated CT at {(ctRate * 100).toFixed(1)}%: £{ctEstimate.toFixed(2)}.
        Tax pot balance: £{potBalance.toFixed(2)}{' '}
        {potBalance >= ctEstimate ? (
          <span className="text-brand-teal-deep">(covered)</span>
        ) : (
          <span className="text-brand-amber">
            (short £{(ctEstimate - potBalance).toFixed(2)})
          </span>
        )}
      </p>

      {/* Breakdowns */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Takings by source
          </h2>
          {bySource.size === 0 ? (
            <p className="mt-3 text-sm text-brand-slate">
              No takings in period.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {Array.from(bySource.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([src, amt]) => {
                  const pct =
                    totalTakings === 0 ? 0 : (amt / totalTakings) * 100
                  return (
                    <li key={src}>
                      <div className="flex items-center justify-between">
                        <span className="text-brand-forest">
                          {TAKINGS_SOURCE_LABEL[src] ?? src}
                        </span>
                        <span className="font-mono text-brand-forest">
                          £{amt.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-brand-sage/30">
                        <div
                          className="h-2 rounded-full bg-brand-teal-deep"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-brand-sage/40 bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-teal-deep">
            Expenses by category
          </h2>
          {byCategory.size === 0 ? (
            <p className="mt-3 text-sm text-brand-slate">
              No expenses in period.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {Array.from(byCategory.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => {
                  const pct =
                    totalExpenses === 0 ? 0 : (amt / totalExpenses) * 100
                  return (
                    <li key={cat}>
                      <div className="flex items-center justify-between">
                        <span className="text-brand-forest">
                          {EXPENSE_CATEGORY_LABEL[cat] ?? cat}
                        </span>
                        <span className="font-mono text-brand-forest">
                          £{amt.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-brand-sage/30">
                        <div
                          className="h-2 rounded-full bg-brand-amber"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function PresetLink({ label, preset }: { label: string; preset: Preset }) {
  return (
    <Link
      href={`/owner/pl?preset=${preset}`}
      className="rounded-lg border border-brand-sage/60 px-3 py-1 text-brand-forest hover:bg-brand-sage/10"
    >
      {label}
    </Link>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'teal' | 'amber'
}) {
  return (
    <div className="rounded-xl border border-brand-sage/40 bg-white p-5">
      <p className="text-xs text-brand-slate">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === 'teal' ? 'text-brand-teal-deep' : 'text-brand-amber'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
