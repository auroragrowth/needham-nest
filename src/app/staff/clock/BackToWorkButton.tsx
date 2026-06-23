'use client'

import { useState, useEffect } from 'react'
import { endBreak } from '@/lib/time-logs/actions'

/**
 * Wraps the 'Back to work' submit. Two coaching states:
 *  - elapsed < required → 'you still have X min left' + confirm on early end
 *  - elapsed > required → 'you're X min over the statutory minimum — unpaid'
 *
 * The button never blocks the staff member from ending the break; the
 * confirm is just a heads-up so they don't accidentally cut it short.
 */
export function BackToWorkButton({
  breakStartAt,
  requiredMinutes,
}: {
  breakStartAt: string
  requiredMinutes: number
}) {
  const startMs = new Date(breakStartAt).getTime()
  const [elapsedMin, setElapsedMin] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startMs) / 60000)),
  )

  // Tick every 15s so the elapsed counter (and message) stays live.
  useEffect(() => {
    const t = setInterval(() => {
      setElapsedMin(Math.max(0, Math.floor((Date.now() - startMs) / 60000)))
    }, 15000)
    return () => clearInterval(t)
  }, [startMs])

  const remaining = Math.max(0, requiredMinutes - elapsedMin)
  const over = Math.max(0, elapsedMin - requiredMinutes)
  const isShort = remaining > 0
  const isOver = !isShort && over > 0

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!isShort) return
    const ok = window.confirm(
      `You've only had ${elapsedMin} minute${elapsedMin === 1 ? '' : 's'} of your break — statutory minimum is ${requiredMinutes} minutes (you have ${remaining} left).\n\nEnd your break anyway?`,
    )
    if (!ok) e.preventDefault()
  }

  return (
    <form action={endBreak} onSubmit={onSubmit}>
      <button
        type="submit"
        className="w-full rounded-2xl bg-brand-forest px-6 py-5 text-xl font-semibold text-brand-cream shadow-sm transition active:scale-[0.98] hover:bg-brand-olive"
        style={{
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '44px',
        }}
      >
        Back to work
      </button>
      {isShort && (
        <p className="mt-2 text-sm font-semibold text-brand-amber">
          ⚠ {remaining} minute{remaining === 1 ? '' : 's'} left to reach the
          statutory minimum of {requiredMinutes} min.
        </p>
      )}
      {isOver && (
        <p className="mt-2 text-sm text-brand-slate">
          You&apos;re {over} minute{over === 1 ? '' : 's'} over the
          statutory minimum — this extra time is unpaid.
        </p>
      )}
    </form>
  )
}
