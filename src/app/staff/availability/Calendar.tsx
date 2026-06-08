'use client'

import { useState } from 'react'

type Window = {
  id: string
  start_time: string | null
  end_time: string | null
}

type Props = {
  month: string // YYYY-MM
  byDate: Record<string, Window[]>
  addAction: (formData: FormData) => Promise<void>
  deleteAction: (id: string) => Promise<void>
}

function fmtTime(t: string | null): string {
  if (!t) return 'all day'
  return t.slice(0, 5)
}

export function AvailabilityCalendar({
  month,
  byDate,
  addAction,
  deleteAction,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<'all_day' | 'window'>('all_day')

  const [yStr, mStr] = month.split('-')
  const y = Number(yStr)
  const m = Number(mStr) - 1
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay()
  const monMon = (firstDow + 6) % 7 // 0=Mon..6=Sun for grid leading blanks
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

  function selectDay(dateStr: string) {
    setSelected((cur) => (cur === dateStr ? null : dateStr))
    setMode('all_day')
  }

  const selectedEntries = selected ? byDate[selected] ?? [] : []

  return (
    <>
      <div
        className="grid grid-cols-7 gap-1"
        style={{ touchAction: 'manipulation' }}
      >
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-brand-slate"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: monMon }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: lastDay }, (_, i) => {
          const dayNum = i + 1
          const dateStr = `${month}-${String(dayNum).padStart(2, '0')}`
          const entries = byDate[dateStr] ?? []
          const isSelected = selected === dateStr
          const hasAvail = entries.length > 0
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => selectDay(dateStr)}
              className={`min-h-[64px] cursor-pointer rounded-md border p-1.5 text-left text-xs transition active:scale-[0.98] ${
                isSelected
                  ? 'border-brand-amber bg-brand-amber/20 ring-2 ring-brand-amber'
                  : hasAvail
                    ? 'border-brand-teal/40 bg-brand-teal/10 hover:bg-brand-teal/20'
                    : 'border-brand-sage/40 bg-white hover:bg-brand-sage/10'
              }`}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <p className="text-[11px] font-semibold text-brand-forest">
                {dayNum}
              </p>
              <ul className="mt-1 space-y-0.5">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="rounded bg-brand-teal-deep/15 px-1 py-0.5 text-[10px] text-brand-teal-deep"
                  >
                    {fmtTime(e.start_time)}
                    {e.start_time && ` – ${fmtTime(e.end_time)}`}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {selected && (
        <section className="mt-6 rounded-xl border-2 border-brand-amber/60 bg-brand-amber/10 p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-brand-forest">
              {new Date(selected + 'T00:00:00Z').toLocaleDateString([], {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-brand-amber hover:underline"
            >
              Close
            </button>
          </div>

          {selectedEntries.length > 0 && (
            <ul className="mt-3 space-y-1">
              {selectedEntries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-md border border-brand-teal/30 bg-white px-3 py-2 text-sm"
                >
                  <span className="text-brand-teal-deep">
                    {e.start_time
                      ? `${fmtTime(e.start_time)} – ${fmtTime(e.end_time)}`
                      : 'Available all day'}
                  </span>
                  <form action={deleteAction.bind(null, e.id)}>
                    <button
                      type="submit"
                      className="text-xs text-brand-amber hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('all_day')}
              className={`cursor-pointer rounded-md px-4 py-2 text-sm font-medium ${
                mode === 'all_day'
                  ? 'bg-brand-forest text-brand-cream'
                  : 'border border-brand-sage/60 bg-white text-brand-forest'
              }`}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                minHeight: '44px',
              }}
            >
              All day
            </button>
            <button
              type="button"
              onClick={() => setMode('window')}
              className={`cursor-pointer rounded-md px-4 py-2 text-sm font-medium ${
                mode === 'window'
                  ? 'bg-brand-forest text-brand-cream'
                  : 'border border-brand-sage/60 bg-white text-brand-forest'
              }`}
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                minHeight: '44px',
              }}
            >
              Specific time window
            </button>
          </div>

          <form
            action={addAction}
            className="mt-3 flex flex-wrap items-end gap-2"
            key={selected + mode}
          >
            <input type="hidden" name="date" value={selected} />
            {mode === 'all_day' && (
              <input type="hidden" name="all_day" value="on" />
            )}
            {mode === 'window' && (
              <>
                <div>
                  <label
                    htmlFor="avail_start"
                    className="block text-xs font-medium text-brand-forest"
                  >
                    From
                  </label>
                  <input
                    id="avail_start"
                    name="start_time"
                    type="time"
                    required
                    className="mt-1 block cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitAppearance: 'none',
                      minHeight: '44px',
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="avail_end"
                    className="block text-xs font-medium text-brand-forest"
                  >
                    To
                  </label>
                  <input
                    id="avail_end"
                    name="end_time"
                    type="time"
                    required
                    className="mt-1 block cursor-pointer rounded-md border border-brand-sage/60 bg-white px-3 py-3 text-base text-brand-forest outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                    style={{
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitAppearance: 'none',
                      minHeight: '44px',
                    }}
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              className="cursor-pointer rounded-md bg-brand-amber px-5 py-3 text-base font-semibold text-brand-forest hover:bg-brand-amber/90"
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                minHeight: '44px',
              }}
            >
              {mode === 'all_day' ? 'Save all day' : 'Save window'}
            </button>
          </form>
        </section>
      )}
    </>
  )
}
