/**
 * Small, plain building blocks for the Insights screen.
 *
 * The café iPad is an iPad Air 2 on iOS 15, which has no color-mix(), so any
 * see-through colour here is an explicit rgba() in a style attribute rather
 * than a Tailwind /NN opacity class. Charts are plain divs: no library, nothing
 * to load, and they print.
 */
import Link from 'next/link'

export const DOW = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DOW_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const FOREST = '#17443f'
export const AMBER = '#e6a251'
export const SAGE = '#89ac9e'
export const RED = '#b4533a'

/** £1,234.56, or £1,235 when whole pounds read better. */
export function money(pence: number | null | undefined, whole = false): string {
  if (pence == null) return '–'
  const pounds = pence / 100
  return pounds.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })
}

/** 10 → "10am", 12 → "12pm", 13 → "1pm". */
export function hourLabel(h: number | null | undefined): string {
  if (h == null) return '–'
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

export function hourRange(h: number): string {
  return `${hourLabel(h)}–${hourLabel(h + 1)}`
}

/** Percentage change, or null when there is nothing fair to compare with. */
export function change(now: number, before: number): number | null {
  if (!before) return null
  return ((now - before) / before) * 100
}

export function Change({ now, before, suffix = 'on the period before' }: { now: number; before: number; suffix?: string }) {
  const pct = change(now, before)
  if (pct == null) return <span className="text-brand-slate">nothing to compare with</span>
  const up = pct >= 0
  return (
    <span style={{ color: up ? FOREST : RED }} className="font-medium">
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% <span className="font-normal text-brand-slate">{suffix}</span>
    </span>
  )
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-sage bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-brand-slate">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-brand-forest">{value}</div>
      {sub && <div className="mt-1 text-xs">{sub}</div>}
    </div>
  )
}

export function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-brand-forest">{title}</h2>
      {note && <p className="mt-1 text-sm text-brand-slate">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** A row of horizontal bars, scaled to the biggest value. */
export function Bars({
  rows,
  highlight,
}: {
  rows: { label: string; value: number; display: string; extra?: string }[]
  highlight?: (index: number) => boolean
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  // Every row keeps the same columns, so the bars line up even when only some
  // rows have a note on the end.
  const hasExtra = rows.some((r) => r.extra != null)
  return (
    <div className="rounded-2xl border border-brand-sage bg-white p-4">
      {rows.map((r, i) => (
        <div key={r.label} className="flex items-center py-1 text-sm">
          <div className="w-28 shrink-0 text-brand-forest">{r.label}</div>
          <div className="mx-3 h-6 flex-1 rounded" style={{ background: 'rgba(137,172,158,0.18)' }}>
            <div
              className="h-6 rounded"
              style={{ width: `${(100 * r.value) / max}%`, background: highlight?.(i) ? AMBER : FOREST }}
            />
          </div>
          <div className="w-20 shrink-0 text-right font-medium text-brand-forest">{r.display}</div>
          {hasExtra && <div className="ml-3 w-36 shrink-0 text-right text-xs text-brand-slate">{r.extra ?? ''}</div>}
        </div>
      ))}
    </div>
  )
}

/** Amber cell shaded by how busy it is, 0 to 1. */
export function heat(level: number): string {
  const a = Math.max(0, Math.min(1, level))
  return a === 0 ? 'rgba(137,172,158,0.08)' : `rgba(230,162,81,${(0.12 + 0.88 * a).toFixed(2)})`
}

export function Tabs({ current, items }: { current: string; items: { id: string; label: string; href: string }[] }) {
  return (
    <nav className="mt-5 flex flex-wrap gap-2">
      {items.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            t.id === current
              ? 'border-brand-forest bg-brand-forest text-white'
              : 'border-brand-sage bg-white text-brand-forest'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
