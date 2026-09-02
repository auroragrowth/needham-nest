'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
  /** Optional internal path to return to after a successful sign-in. */
  next?: string
}

/**
 * One numeric input → device numeric keypad. Submits when 4 digits are
 * entered. Works on iPad iOS 15 (legacy .click() path) and modern Safari
 * (requestSubmit). The visible Sign in button is the manual fallback.
 */
export function PinPad({ action, next }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const hiddenSubmitRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (pin.length !== 4 || submitting) return
    const form = formRef.current
    if (!form) return

    setSubmitting(true)

    // Prefer requestSubmit (iOS 16+, all modern browsers) — it triggers
    // React's server-action handler properly. Fall back to clicking a
    // hidden submit button for iOS 15.x (iPad Air 2).
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit(hiddenSubmitRef.current ?? undefined)
    } else {
      hiddenSubmitRef.current?.click()
    }
  }, [pin, submitting])

  // If submit silently fails, unstick after 10s so the user can retry.
  useEffect(() => {
    if (!submitting) return
    const t = setTimeout(() => setSubmitting(false), 10000)
    return () => clearTimeout(t)
  }, [submitting])

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col items-center gap-6"
    >
      {next && <input type="hidden" name="next" value={next} />}
      <input
        name="pin"
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        autoComplete="off"
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
        style={{
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          WebkitAppearance: 'none',
        }}
      />

      {/* Off-screen submit so requestSubmit/.click can trigger the server
          action even when the visible button is disabled. Positioned with
          inline styles (not Tailwind) to ensure reliable cross-browser
          off-screen placement without pointer-events:none, which blocked
          programmatic clicks on iOS. */}
      <button
        ref={hiddenSubmitRef}
        type="submit"
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
        }}
      >
        Submit
      </button>

      <button
        type="submit"
        disabled={submitting || pin.length !== 4}
        className="rounded-lg bg-brand-forest px-8 py-3 text-base font-medium text-brand-cream hover:bg-brand-olive disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          minHeight: '44px',
        }}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-xs text-brand-slate">
        Tap the box, then type your 4-digit PIN.
      </p>
    </form>
  )
}
