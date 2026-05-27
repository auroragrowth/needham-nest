'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

/**
 * Minimal PIN entry: one text input that triggers the device's native
 * numeric keypad. Works on every browser back to ancient Safari without
 * relying on JS event handling for digit buttons.
 *
 * Submits when 4 digits are entered (via JS if available) OR when the
 * user clicks the visible Sign in button.
 */
export function PinPad({ action }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const hiddenSubmitRef = useRef<HTMLButtonElement>(null)

  // Auto-submit when 4 digits entered. Click the hidden (never disabled)
  // submit button so the form posts even though the visible button has
  // already gone disabled.
  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      setSubmitting(true)
      const t = setTimeout(() => {
        hiddenSubmitRef.current?.click()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [pin, submitting])

  // Defensive: if the submit silently fails, reset after 10s so the UI
  // never gets permanently stuck.
  useEffect(() => {
    if (!submitting) return
    const t = setTimeout(() => setSubmitting(false), 10000)
    return () => clearTimeout(t)
  }, [submitting])

  return (
    <form action={action} className="flex flex-col items-center gap-6">
      <input
        name="pin"
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        autoComplete="one-time-code"
        maxLength={4}
        required
        autoFocus
        value={pin}
        onChange={(e) => {
          if (submitting) return
          setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
        }}
        aria-label="PIN"
        placeholder="••••"
        className="w-48 rounded-2xl border-2 border-brand-sage/60 bg-white px-4 py-4 text-center font-mono text-4xl tracking-[0.5em] text-brand-forest outline-none focus:border-brand-amber focus:ring-2 focus:ring-brand-amber/30"
      />

      {/* Always-enabled hidden submit button used for auto-submit. */}
      <button
        ref={hiddenSubmitRef}
        type="submit"
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute h-0 w-0 overflow-hidden border-0 p-0 opacity-0"
      >
        Submit
      </button>

      {/* Visible Sign in button — manual fallback / Enter target. */}
      <button
        type="submit"
        disabled={submitting || pin.length !== 4}
        className="rounded-lg bg-brand-forest px-8 py-3 text-base font-medium text-brand-cream hover:bg-brand-olive disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-xs text-brand-slate">
        Tap the box, then type your 4-digit PIN.
      </p>
    </form>
  )
}
