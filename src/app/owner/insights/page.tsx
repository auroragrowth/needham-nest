import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { tillInsights, type Insights, type InsightItem } from '@/lib/till/insights'
import {
  AMBER,
  Bars,
  Change,
  DOW,
  DOW_LONG,
  FOREST,
  RED,
  Section,
  Stat,
  Tabs,
  change,
  heat,
  hourLabel,
  hourRange,
  money,
} from './parts'

export const dynamic = 'force-dynamic'

/** The day the café opened: the earliest anything can go back to. */
const OPENED = '2026-06-15'

type View = 'overview' | 'when' | 'items' | 'profit' | 'slow'
type Sort = 'takings' | 'qty' | 'rising' | 'falling' | 'margin'

function londonDay(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function prettyDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const PRESETS = [
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '28', label: 'Last 4 weeks', days: 28 },
  { id: '91', label: 'Last 13 weeks', days: 91 },
  { id: 'all', label: 'Since opening', days: 0 },
] as const

/**
 * Whole days only, ending yesterday: today is still trading, and a half day
 * would drag every daily average down.
 */
function resolveRange(sp: { range?: string; from?: string; to?: string }): { from: string; to: string; id: string } {
  const day = /^\d{4}-\d{2}-\d{2}$/
  if (sp.from && sp.to && day.test(sp.from) && day.test(sp.to) && sp.from <= sp.to) {
    return { from: sp.from < OPENED ? OPENED : sp.from, to: sp.to, id: 'custom' }
  }
  const to = londonDay(-1)
  const preset = PRESETS.find((p) => p.id === sp.range) ?? PRESETS[1]
  const from = preset.days ? addDays(to, -(preset.days - 1)) : OPENED
  return { from: from < OPENED ? OPENED : from, to, id: preset.id }
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; view?: View; sort?: Sort }>
}) {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')

  const sp = await searchParams
  const range = resolveRange(sp)
  const view: View = (['overview', 'when', 'items', 'profit', 'slow'] as const).includes(sp.view as View)
    ? (sp.view as View)
    : 'overview'
  const sort: Sort = (['takings', 'qty', 'rising', 'falling', 'margin'] as const).includes(sp.sort as Sort)
    ? (sp.sort as Sort)
    : 'takings'

  const rangeQuery = range.id === 'custom' ? `from=${range.from}&to=${range.to}` : `range=${range.id}`
  const href = (v: View, extra = '') => `/owner/insights?${rangeQuery}&view=${v}${extra}`

  let data: Insights | null = null
  let failure: string | null = null
  try {
    data = await tillInsights(range.from, range.to)
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e)
  }

  return (
    <main className="mx-auto max-w-5xl pb-16">
      <Link href="/owner" className="text-sm text-brand-slate">
        ← Owner
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-forest">Insights</h1>
      <p className="mt-1 text-sm text-brand-slate">
        What sells, when, and what it earns. Straight from the till, {prettyDay(range.from)} to {prettyDay(range.to)}.
        Staff tabs are left out.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.id}
            href={`/owner/insights?range=${p.id}&view=${view}`}
            className={`rounded-lg border px-3 py-2 text-sm ${
              range.id === p.id ? 'border-brand-amber bg-brand-amber font-semibold text-brand-forest' : 'border-brand-sage bg-white text-brand-forest'
            }`}
          >
            {p.label}
          </Link>
        ))}
        <form className="flex items-end gap-2" action="/owner/insights">
          <input type="hidden" name="view" value={view} />
          <label className="text-xs text-brand-slate">
            From
            <input type="date" name="from" defaultValue={range.from} min={OPENED} className="mt-1 block rounded-lg border border-brand-sage bg-white px-2 py-1.5 text-sm text-brand-forest" />
          </label>
          <label className="text-xs text-brand-slate">
            To
            <input type="date" name="to" defaultValue={range.to} className="mt-1 block rounded-lg border border-brand-sage bg-white px-2 py-1.5 text-sm text-brand-forest" />
          </label>
          <button className="rounded-lg bg-brand-forest px-3 py-2 text-sm font-medium text-white">Show</button>
        </form>
      </div>

      <Tabs
        current={view}
        items={[
          { id: 'overview', label: 'Overview', href: href('overview') },
          { id: 'when', label: 'Busy times', href: href('when') },
          { id: 'items', label: 'Best sellers', href: href('items') },
          { id: 'profit', label: 'Cost and profit', href: href('profit') },
          { id: 'slow', label: 'Not selling', href: href('slow') },
        ]}
      />

      {failure && (
        <p className="mt-6 rounded-xl border border-brand-amber bg-white p-4 text-sm text-brand-forest">
          Could not reach the till just now: {failure}. Try again in a minute.
        </p>
      )}

      {data && data.totals.orders === 0 && (
        <p className="mt-6 rounded-xl border border-brand-sage bg-white p-4 text-sm text-brand-forest">
          No sales in these dates.
        </p>
      )}

      {data && data.totals.orders > 0 && (
        <>
          {view === 'overview' && <Overview d={data} />}
          {view === 'when' && <BusyTimes d={data} />}
          {view === 'items' && <BestSellers d={data} sort={sort} href={(s) => href('items', `&sort=${s}`)} />}
          {view === 'profit' && <Profit d={data} />}
          {view === 'slow' && <NotSelling d={data} />}
        </>
      )}
    </main>
  )
}

/* ------------------------------------------------------------------------- */
/* Overview                                                                   */
/* ------------------------------------------------------------------------- */

/** Plain-English things worth knowing, worked out from the figures. */
function headlines(d: Insights): string[] {
  const out: string[] = []
  const t = d.totals

  const perDay = t.days_traded ? t.takings / t.days_traded : 0
  const prevPerDay = t.prev_days_traded ? t.prev_takings / t.prev_days_traded : 0
  const pct = change(perDay, prevPerDay)
  if (pct != null) {
    out.push(
      `Takings averaged ${money(perDay, true)} a day, ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(0)}% on the ${d.range.days} days before.`,
    )
  }

  const wd = [...d.weekdays].filter((w) => w.days > 0).sort((a, b) => b.avg_takings - a.avg_takings)
  if (wd.length >= 5) {
    const best = wd[0]
    const worst = wd[wd.length - 1]
    out.push(
      `${DOW_LONG[best.dow]} is the busiest day at ${money(best.avg_takings, true)} on average. ${DOW_LONG[worst.dow]} is the quietest at ${money(worst.avg_takings, true)}, ${Math.round((100 * (best.avg_takings - worst.avg_takings)) / best.avg_takings)}% less.`,
    )
  }

  const hours = [...d.hours].sort((a, b) => b.avg_takings - a.avg_takings)
  if (hours.length) {
    const top = hours[0]
    const lunch = d.hours.filter((h) => h.hour >= 11 && h.hour <= 13).reduce((s, h) => s + (h.share_pct ?? 0), 0)
    out.push(
      `The busiest hour is ${hourRange(top.hour)}, about ${money(top.avg_takings, true)} a day. 11am to 2pm brings in ${lunch.toFixed(0)}% of the day's takings.`,
    )
    const opening = d.hours.filter((h) => h.hour === 8 || h.hour === 9).reduce((s, h) => s + h.avg_takings, 0)
    out.push(`The first two hours (8 to 10am) take about ${money(opening, true)} a day between them.`)
  }

  const byNet = d.items.filter((i) => i.id)
  if (byNet.length) {
    const topNet = byNet[0]
    const topQty = [...byNet].sort((a, b) => b.qty - a.qty)[0]
    out.push(
      topNet.name === topQty.name
        ? `${topNet.name} is the biggest seller: ${topNet.qty} sold, ${money(topNet.net, true)}, ${topNet.share_pct}% of everything.`
        : `${topNet.name} brings in the most (${money(topNet.net, true)}). ${topQty.name} sells the most (${topQty.qty}).`,
    )
  }

  const movers = d.items.filter((i) => i.id && Math.max(i.qty, i.prev_qty) >= 15 && i.prev_qty > 0)
  const rising = [...movers].sort((a, b) => (change(b.qty, b.prev_qty) ?? 0) - (change(a.qty, a.prev_qty) ?? 0))[0]
  const falling = [...movers].sort((a, b) => (change(a.qty, a.prev_qty) ?? 0) - (change(b.qty, b.prev_qty) ?? 0))[0]
  if (rising && (change(rising.qty, rising.prev_qty) ?? 0) >= 20) {
    out.push(`${rising.name} is on the up: ${rising.qty} sold against ${rising.prev_qty} the period before.`)
  }
  if (falling && (change(falling.qty, falling.prev_qty) ?? 0) <= -20) {
    out.push(`${falling.name} has dropped: ${falling.qty} sold against ${falling.prev_qty} the period before.`)
  }

  const neverSold = d.not_selling.filter((n) => n.qty === 0).length
  if (d.not_selling.length) {
    out.push(
      `${d.not_selling.length} items on the till hardly sold in these dates${neverSold ? `, ${neverSold} not at all` : ''}. See Not selling.`,
    )
  }

  const inside = d.order_types.find((o) => o.type === 'have_in')
  const away = d.order_types.find((o) => o.type === 'takeout')
  if (inside && away) {
    out.push(
      `Eat-in spends ${money(inside.avg_spend)} a visit, takeaway ${money(away.avg_spend)}. Takeaway is ${Math.round((100 * away.orders) / t.orders)}% of orders.`,
    )
  }
  if (d.basket.one_item_orders_pct != null) {
    out.push(`${d.basket.one_item_orders_pct}% of orders are a single item. The average order is ${d.basket.items_per_order} items.`)
  }

  if (d.costing.items_costed === 0) {
    out.push(`Profit per item can't be worked out yet: no ingredient costs have been approved. See Cost and profit.`)
  }
  return out
}

function Overview({ d }: { d: Insights }) {
  const t = d.totals
  const perDay = t.days_traded ? t.takings / t.days_traded : 0
  const prevPerDay = t.prev_days_traded ? t.prev_takings / t.prev_days_traded : 0

  // Over three weeks, a bar per week reads better than a bar per day.
  const weekly = d.daily.length > 21
  const trend = weekly ? byWeek(d.daily) : d.daily.map((x) => ({ label: `${DOW[x.dow]} ${prettyDay(x.date)}`, takings: x.takings, days: 1 }))

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Takings" value={money(t.takings, true)} sub={<Change now={t.takings} before={t.prev_takings} />} />
        <Stat label="A day on average" value={money(perDay, true)} sub={<Change now={perDay} before={prevPerDay} />} />
        <Stat label="Orders" value={t.orders.toLocaleString('en-GB')} sub={<Change now={t.orders} before={t.prev_orders} />} />
        <Stat label="Average spend" value={money(t.avg_spend)} sub={<Change now={t.avg_spend} before={t.prev_avg_spend} />} />
      </div>

      <Section title="Worth knowing">
        <ul className="space-y-2 rounded-2xl border border-brand-sage bg-white p-5 text-[15px] leading-relaxed text-brand-forest">
          {headlines(d).map((h) => (
            <li key={h} className="flex">
              <span className="mr-2" style={{ color: AMBER }}>●</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={weekly ? 'Takings week by week' : 'Takings day by day'} note={weekly ? 'Weeks start on Monday. A part week is marked.' : undefined}>
        <Bars
          rows={trend.map((r) => ({
            label: r.label,
            value: r.takings,
            display: money(r.takings, true),
            extra: weekly && r.days < 7 ? `${r.days} days only` : undefined,
          }))}
        />
      </Section>

      <Section title="Busiest days" note="Average takings on each day of the week. The busiest is picked out in gold.">
        <WeekdayBars d={d} />
      </Section>

      <Section title="Busiest hours" note="Average takings in each hour of a trading day.">
        <HourBars d={d} />
      </Section>

      <Section title="How people pay and eat">
        <div className="grid gap-3 md:grid-cols-2">
          <Bars
            rows={d.order_types.map((o) => ({
              label: o.type === 'have_in' ? 'Eat in' : o.type === 'takeout' ? 'Takeaway' : o.type,
              value: o.takings,
              display: money(o.takings, true),
              extra: `${o.orders} orders`,
            }))}
          />
          <Bars
            rows={d.payments.filter((p) => p.takings > 0).map((p) => ({
              label: p.type[0].toUpperCase() + p.type.slice(1),
              value: p.takings,
              display: money(p.takings, true),
              extra: `${Math.round((100 * p.takings) / t.takings)}%`,
            }))}
          />
        </div>
        {t.discounts > 0 && <p className="mt-2 text-sm text-brand-slate">Discounts given: {money(t.discounts)}.</p>}
      </Section>
    </>
  )
}

function byWeek(daily: Insights['daily']) {
  const weeks = new Map<string, { label: string; takings: number; days: number }>()
  for (const x of daily) {
    const monday = addDays(x.date, -(x.dow - 1))
    const w = weeks.get(monday) ?? { label: `w/c ${prettyDay(monday)}`, takings: 0, days: 0 }
    w.takings += x.takings
    w.days += 1
    weeks.set(monday, w)
  }
  return [...weeks.values()]
}

function WeekdayBars({ d }: { d: Insights }) {
  const best = Math.max(...d.weekdays.map((w) => w.avg_takings))
  return (
    <Bars
      rows={d.weekdays.map((w) => ({
        label: DOW_LONG[w.dow],
        value: w.avg_takings,
        display: money(w.avg_takings, true),
        extra: `${w.avg_orders} orders`,
      }))}
      highlight={(i) => d.weekdays[i].avg_takings === best}
    />
  )
}

function HourBars({ d }: { d: Insights }) {
  const hours = d.hours.filter((h) => h.hour >= 8 && h.hour <= 15)
  const best = Math.max(...hours.map((h) => h.avg_takings))
  return (
    <Bars
      rows={hours.map((h) => ({
        label: hourRange(h.hour),
        value: h.avg_takings,
        display: money(h.avg_takings, true),
        extra: `${h.avg_orders} orders · ${h.share_pct}%`,
      }))}
      highlight={(i) => hours[i].avg_takings === best}
    />
  )
}

/* ------------------------------------------------------------------------- */
/* Busy times                                                                 */
/* ------------------------------------------------------------------------- */

const OPEN_HOURS = [8, 9, 10, 11, 12, 13, 14, 15]

function BusyTimes({ d }: { d: Insights }) {
  const cell = new Map(d.heatmap.map((h) => [`${h.dow}-${h.hour}`, h]))
  const max = Math.max(1, ...d.heatmap.filter((h) => OPEN_HOURS.includes(h.hour)).map((h) => h.avg_takings))

  const names = [...new Set(d.item_hours.map((x) => x.name))]
  const qty = new Map(d.item_hours.map((x) => [`${x.name}-${x.hour}`, x.qty]))

  return (
    <>
      <Section
        title="Day and hour"
        note="Average takings for each hour on each day. The darker the gold, the busier. Use it for the rota and for when the kitchen needs to be ready."
      >
        <div className="overflow-x-auto rounded-2xl border border-brand-sage bg-white p-4">
          <table className="w-full border-separate text-center text-xs" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {OPEN_HOURS.map((h) => (
                  <th key={h} className="pb-1 font-medium text-brand-slate">
                    {hourLabel(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
                <tr key={dow}>
                  <th className="pr-2 text-left font-medium text-brand-forest">{DOW[dow]}</th>
                  {OPEN_HOURS.map((h) => {
                    const c = cell.get(`${dow}-${h}`)
                    const v = c?.avg_takings ?? 0
                    return (
                      <td key={h} className="rounded-md py-3 text-brand-forest" style={{ background: heat(v / max) }}>
                        <div className="font-semibold">{v ? money(v, true) : '–'}</div>
                        <div className="text-[10px] opacity-75">{c ? `${c.avg_orders} ord` : ''}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="What sells when"
        note="The twelve best sellers by number sold, and when in the day they go. Each row is shaded against its own busiest hour, so you can see the shape of each one."
      >
        <div className="overflow-x-auto rounded-2xl border border-brand-sage bg-white p-4">
          <table className="w-full border-separate text-center text-xs" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {OPEN_HOURS.map((h) => (
                  <th key={h} className="pb-1 font-medium text-brand-slate">
                    {hourLabel(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((name) => {
                const rowMax = Math.max(1, ...OPEN_HOURS.map((h) => qty.get(`${name}-${h}`) ?? 0))
                return (
                  <tr key={name}>
                    <th className="max-w-[12rem] pr-2 text-left font-medium text-brand-forest">{name}</th>
                    {OPEN_HOURS.map((h) => {
                      const q = qty.get(`${name}-${h}`) ?? 0
                      return (
                        <td key={h} className="rounded-md py-2 text-brand-forest" style={{ background: heat(q / rowMax) }}>
                          {q || ''}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Busiest days">
        <WeekdayBars d={d} />
      </Section>
      <Section title="Busiest hours">
        <HourBars d={d} />
      </Section>
    </>
  )
}

/* ------------------------------------------------------------------------- */
/* Best sellers                                                               */
/* ------------------------------------------------------------------------- */

function BestSellers({ d, sort, href }: { d: Insights; sort: Sort; href: (s: Sort) => string }) {
  const growth = (i: InsightItem) => (i.prev_qty ? (i.qty - i.prev_qty) / i.prev_qty : i.qty ? 9 : 0)
  // Rising and falling only count items with enough sales to mean something.
  const enough = (i: InsightItem) => Math.max(i.qty, i.prev_qty) >= 10
  let rows = [...d.items]
  if (sort === 'qty') rows.sort((a, b) => b.qty - a.qty)
  if (sort === 'rising') rows = rows.filter(enough).sort((a, b) => growth(b) - growth(a))
  if (sort === 'falling') rows = rows.filter(enough).sort((a, b) => growth(a) - growth(b))
  if (sort === 'margin') rows.sort((a, b) => (b.margin_pct ?? -999) - (a.margin_pct ?? -999))

  const sorts: { id: Sort; label: string }[] = [
    { id: 'takings', label: 'Most takings' },
    { id: 'qty', label: 'Most sold' },
    { id: 'rising', label: 'Rising' },
    { id: 'falling', label: 'Falling' },
    { id: 'margin', label: 'Best margin' },
  ]

  return (
    <>
      <Section title="By category" note="Share of item takings, and the change on the period before.">
        <Bars
          rows={d.categories.map((c) => {
            const pct = change(c.net, c.prev_net)
            return {
              label: c.category,
              value: c.net,
              display: money(c.net, true),
              extra: `${c.share_pct ?? 0}% · ${pct == null ? 'new' : `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`}`,
            }
          })}
        />
      </Section>

      <Section
        title="Every item"
        note="Takings are after discounts, and include any paid add-ons. ‘Busiest’ is the hour and day it sells most. The change compares with the same number of days just before."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {sorts.map((s) => (
            <Link
              key={s.id}
              href={href(s.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                s.id === sort ? 'border-brand-amber bg-brand-amber font-semibold text-brand-forest' : 'border-brand-sage bg-white text-brand-forest'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-brand-sage bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-brand-slate">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3 text-right">Sold</th>
                <th className="p-3 text-right">Takings</th>
                <th className="p-3 text-right">Share</th>
                <th className="p-3 text-right">Change</th>
                <th className="p-3">Busiest</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const pct = change(i.qty, i.prev_qty)
                return (
                  <tr key={`${i.id}-${i.name}`} className="border-t border-brand-cream">
                    <td className="p-3">
                      <div className="font-medium text-brand-forest">{i.name}</div>
                      <div className="text-xs text-brand-slate">{i.category}</div>
                    </td>
                    <td className="p-3 text-right text-brand-forest">{i.qty}</td>
                    <td className="p-3 text-right font-medium text-brand-forest">{money(i.net)}</td>
                    <td className="p-3 text-right text-brand-slate">{i.share_pct ?? 0}%</td>
                    <td className="p-3 text-right" style={{ color: pct == null ? undefined : pct >= 0 ? FOREST : RED }}>
                      {pct == null ? <span className="text-brand-slate">new</span> : `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`}
                    </td>
                    <td className="p-3 text-brand-forest">
                      {hourLabel(i.peak_hour)}
                      {i.best_dow ? `, ${DOW[i.best_dow]}` : ''}
                    </td>
                    <td className="p-3 text-right text-brand-slate">{i.price ? money(i.price) : '–'}</td>
                    <td className="p-3 text-right">
                      <MarginCell i={i} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

function MarginCell({ i }: { i: InsightItem }) {
  if (i.margin_pct == null) return <span className="text-xs text-brand-slate">cost not known</span>
  const low = i.target_min != null && i.margin_pct < i.target_min
  return (
    <span style={{ color: low ? RED : FOREST }} className="font-medium">
      {i.margin_pct}%{low ? ' ▼' : ''}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/* Cost and profit                                                            */
/* ------------------------------------------------------------------------- */

function Profit({ d }: { d: Insights }) {
  const c = d.costing
  const costed = d.items.filter((i) => i.unit_cost != null)
  const partly = d.items.filter((i) => i.id && i.cost_source === 'recipe partly costed')
  const noRecipe = d.items.filter((i) => i.id && i.cost_source === 'no recipe' && (i.price ?? 0) > 0)
  const profit = costed.reduce((s, i) => s + (i.profit ?? 0), 0)
  const costedNet = costed.reduce((s, i) => s + i.net, 0)
  const allNet = d.items.reduce((s, i) => s + i.net, 0)

  return (
    <>
      <Section title="Where the costs stand">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Ingredients with a cost" value={`${c.ingredient_costs} of ${c.ingredients}`} />
          <Stat label="Items with a recipe" value={`${c.items_with_recipe} of ${c.active_items}`} />
          <Stat label="Items fully costed" value={`${c.items_costed}`} />
          <Stat label="Takings we can cost" value={allNet ? `${Math.round((100 * costedNet) / allNet)}%` : '–'} />
        </div>
        <div className="mt-3 rounded-2xl border border-brand-amber bg-white p-4 text-sm leading-relaxed text-brand-forest">
          Cost per item is the recipe on the till priced at each ingredient&rsquo;s latest approved invoice cost. It fills
          in by itself as invoices are read and costs are approved, and an item only shows a cost once every ingredient in
          its recipe has one. Cups, lids and add-ons are not counted yet, and some recipes are missing things like the
          bread, so treat early margins as a best case until the recipes are checked.
        </div>
      </Section>

      {costed.length > 0 && (
        <Section
          title="Profit by item"
          note={`Takings less ingredient cost, for the ${costed.length} items we can cost: ${money(profit, true)} on ${money(costedNet, true)} of takings. Red means below the margin target for that kind of item.`}
        >
          <div className="overflow-x-auto rounded-2xl border border-brand-sage bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-brand-slate">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3 text-right">Price</th>
                  <th className="p-3 text-right">Cost to make</th>
                  <th className="p-3 text-right">Margin</th>
                  <th className="p-3 text-right">Target</th>
                  <th className="p-3 text-right">Sold</th>
                  <th className="p-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {[...costed].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0)).map((i) => (
                  <tr key={`${i.id}-${i.name}`} className="border-t border-brand-cream">
                    <td className="p-3 font-medium text-brand-forest">{i.name}</td>
                    <td className="p-3 text-right">{money(i.price)}</td>
                    <td className="p-3 text-right">{money(i.unit_cost)}</td>
                    <td className="p-3 text-right"><MarginCell i={i} /></td>
                    <td className="p-3 text-right text-brand-slate">
                      {i.target_min != null ? `${i.target_min}–${i.target_max}%` : '–'}
                    </td>
                    <td className="p-3 text-right">{i.qty}</td>
                    <td className="p-3 text-right font-medium" style={{ color: (i.profit ?? 0) < 0 ? RED : FOREST }}>
                      {money(i.profit, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {partly.length > 0 && (
        <Section
          title="Recipe there, costs still missing"
          note="These have a recipe on the till but at least one ingredient has no approved cost yet. Biggest sellers first, because they matter most."
        >
          <MissingList items={partly} show={(i) => `${i.costed_lines ?? 0} of ${i.recipe_lines ?? 0} ingredients costed`} />
        </Section>
      )}

      {noRecipe.length > 0 && (
        <Section
          title="No recipe on the till"
          note="Without a recipe there is no way to work out what these cost to make. Adding one also makes the stock count go down as they sell."
        >
          <MissingList items={noRecipe} show={() => 'no recipe'} />
        </Section>
      )}
    </>
  )
}

function MissingList({ items, show }: { items: InsightItem[]; show: (i: InsightItem) => string }) {
  return (
    <div className="rounded-2xl border border-brand-sage bg-white">
      {items.map((i) => (
        <div key={`${i.id}-${i.name}`} className="flex items-center justify-between border-t border-brand-cream px-4 py-2 text-sm first:border-t-0">
          <span className="font-medium text-brand-forest">{i.name}</span>
          <span className="text-brand-slate">
            {money(i.net, true)} taken · {show(i)}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Not selling                                                                */
/* ------------------------------------------------------------------------- */

function NotSelling({ d }: { d: Insights }) {
  const threshold = Math.max(2, Math.floor(d.range.days / 14))
  return (
    <Section
      title="Hardly selling"
      note={`Items on the till that sold ${threshold} or fewer in these dates. Something added recently will show here until it has had time to sell, so check the last sold date before taking anything off.`}
    >
      {d.not_selling.length === 0 ? (
        <p className="rounded-2xl border border-brand-sage bg-white p-4 text-sm text-brand-forest">Everything on the till sold more than that.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-sage bg-white">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-brand-slate">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Sold</th>
                <th className="p-3 text-right">Last sold</th>
              </tr>
            </thead>
            <tbody>
              {d.not_selling.map((n) => (
                <tr key={n.id} className="border-t border-brand-cream">
                  <td className="p-3 font-medium text-brand-forest">{n.name}</td>
                  <td className="p-3 text-brand-slate">{n.category}</td>
                  <td className="p-3 text-right">{money(n.price)}</td>
                  <td className="p-3 text-right" style={{ color: n.qty === 0 ? RED : undefined }}>{n.qty}</td>
                  <td className="p-3 text-right text-brand-slate">{n.last_sold ? prettyDay(n.last_sold) : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
