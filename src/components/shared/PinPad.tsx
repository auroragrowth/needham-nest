'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

export function PinPad({ action }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function press(digit: string) {
    if (pin.length >= 4 || submitting) return
    setPin((p) => p + digit)
  }

  function backspace() {
    if (submitting) return
    setPin((p) => p.slice(0, -1))
  }

  function clearPin() {
    if (submitting) return
    setPin('')
  }

  // Auto-submit when 4 digits entered. Use standard form submission so iOS
  // Safari handles redirects exactly like a posted form.
  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      setSubmitting(true)
      // Small tick so the dot UI paints before submit
      requestAnimationFrame(() => {
        formRef.current?.requestSubmit()
      })
    }
  }, [pin, submitting])

  // Physical keyboard fallback for desktop owners.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (submitting) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') backspace()
      else if (e.key === 'Escape') clearPin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, submitting])

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col items-center"
      style={{ touchAction: 'manipulation' }}
    >
      <input type="hidden" name="pin" value={pin} readOnly />

      <div
        className="flex gap-3"
        aria-label={`PIN: ${pin.length} of 4 digits entered`}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-colors ${
              i < pin.length
                ? 'border-brand-amber bg-brand-amber'
                : 'border-brand-sage/60'
            }`}
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PadButton key={d} onPress={() => press(d)} disabled={submitting}>
            {d}
          </PadButton>
        ))}
        <PadButton
          onPress={clearPin}
          disabled={submitting}
          className="text-sm font-medium"
        >
          Clear
        </PadButton>
        <PadButton onPress={() => press('0')} disabled={submitting}>
          0
        </PadButton>
        <PadButton
          onPress={backspace}
          disabled={submitting}
          aria-label="Backspace"
          className="text-2xl"
        >
          ⌫
        </PadButton>
      </div>

      {submitting && (
        <p className="mt-6 text-sm text-brand-slate">Signing in…</p>
      )}
    </form>
  )
}

/**
 * Tap-friendly pad button. We handle pointerdown (fires reliably on iPadOS
 * and avoids the click delay) AND click (so keyboard and mouse still work).
 * The handler de-dupes via a ref so a tap doesn't double-fire.
 */
function PadButton({
  children,
  onPress,
  disabled,
  className = '',
  ...rest
}: {
  children: React.ReactNode
  onPress: () => void
  disabled?: boolean
  className?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const lastFiredRef = useRef(0)
  function fire() {
    const now = Date.now()
    if (now - lastFiredRef.current < 250) return
    lastFiredRef.current = now
    onPress()
  }
  return (
    <button
      type="button"
      onClick={fire}
      onPointerDown={fire}
      disabled={disabled}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      className={`h-20 w-20 cursor-pointer select-none rounded-2xl border border-brand-sage/40 bg-white text-3xl font-medium text-brand-forest shadow-sm transition active:scale-95 hover:bg-brand-sage/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
