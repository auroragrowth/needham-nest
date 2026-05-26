'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

/**
 * Tap-friendly PIN entry. A real text input is rendered (focused on mount)
 * so iPadOS shows its native number pad. Below that, a visible button grid
 * works as backup for any device where the soft keyboard doesn't appear.
 */
export function PinPad({ action }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function append(digit: string) {
    if (pin.length >= 4 || submitting) return
    setPin((p) => (p + digit).slice(0, 4))
  }

  function backspace() {
    if (submitting) return
    setPin((p) => p.slice(0, -1))
  }

  function clearPin() {
    if (submitting) return
    setPin('')
  }

  // Autofocus the input on mount so iPad shows its number pad immediately.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-submit when 4 digits entered.
  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      setSubmitting(true)
      // tiny delay so the 4th dot paints first
      const t = setTimeout(() => formRef.current?.requestSubmit(), 50)
      return () => clearTimeout(t)
    }
  }, [pin, submitting])

  return (
    <form ref={formRef} action={action} className="flex flex-col items-center">
      <input
        ref={inputRef}
        name="pin"
        type="text"
        inputMode="numeric"
        pattern="\d*"
        autoComplete="one-time-code"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          if (submitting) return
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(digits)
        }}
        aria-label="PIN"
        // Visually hidden but still focusable. Pops the iPadOS number pad.
        className="absolute h-px w-px overflow-hidden border-0 p-0 opacity-0"
        // Some iPads ignore autoFocus on the prop; this is an extra nudge.
        autoFocus
      />

      {/* Dots showing progress */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        aria-label="Tap to bring up the keypad"
        className="flex gap-3 rounded-lg p-2"
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`block h-4 w-4 rounded-full border-2 transition-colors ${
              i < pin.length
                ? 'border-brand-amber bg-brand-amber'
                : 'border-brand-sage/60'
            }`}
          />
        ))}
      </button>

      {/* Visible keypad backup. Standard onClick — no pointer tricks. */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PadButton key={d} onClick={() => append(d)} disabled={submitting}>
            {d}
          </PadButton>
        ))}
        <PadButton
          onClick={clearPin}
          disabled={submitting}
          className="text-sm font-medium"
        >
          Clear
        </PadButton>
        <PadButton onClick={() => append('0')} disabled={submitting}>
          0
        </PadButton>
        <PadButton
          onClick={backspace}
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

function PadButton({
  children,
  onClick,
  disabled,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-20 w-20 cursor-pointer select-none rounded-2xl border border-brand-sage/40 bg-white text-3xl font-medium text-brand-forest shadow-sm transition active:scale-95 hover:bg-brand-sage/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      {...rest}
    >
      {children}
    </button>
  )
}
