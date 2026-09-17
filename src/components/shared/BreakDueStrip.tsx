'use client'

import { useEffect, useState } from 'react'

const REFRESH_MS = 2 * 60 * 1000

/**
 * A reminder above the PIN pad when anyone on shift is due a break. The tablet
 * sits on this screen, so it checks the count every couple of minutes on its
 * own, without reloading the page or clearing a PIN being typed.
 *
 * Counts only: this page is public, so names wait until someone logs in.
 */
export function BreakDueStrip() {
  const [counts, setCounts] = useState<{ soon: number; due: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/breaks/due-count', { cache: 'no-store' })
        if (res.ok && !cancelled) setCounts(await res.json())
      } catch {
        // Offline or a blip: keep what we had and try again next time.
      }
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (!counts || counts.soon + counts.due === 0) return null

  const total = counts.soon + counts.due
  const who = total === 1 ? '1 person on shift is' : `${total} people on shift are`
  const overdue = counts.due > 0

  return (
    <p
      role="status"
      className={`mt-4 w-full rounded-xl border-2 p-3 text-center text-sm font-medium ${
        overdue
          ? 'border-red-600 bg-red-50 text-red-800'
          : 'border-brand-amber bg-brand-amber/10 text-brand-forest'
      }`}
    >
      ⏰ {who} {overdue ? 'overdue a break' : 'due a break soon'} — enter your PIN to check.
    </p>
  )
}
