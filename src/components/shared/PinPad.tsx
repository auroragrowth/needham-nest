'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  action: (formData: FormData) => Promise<void>
}

/**
 * Tap-friendly PIN entry. A real text input is rendered (focused on mount)
 * so iPadOS shows its native number pad. Below that, a visible button grid
 * works as backup for any device where the soft keyboard doesn't appear.
 *
 * Auto-submit uses a hidden submit button rather than form.requestSubmit()
 * because requestSubmit only landed in Safari 16 — older iPads silently
 * fail.
 */
export function PinPad({ action }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submitBtnRef = useRef<HTMLButtonElement>(null)

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

  // Autofocus the input on mount so iPad shows its number pad.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-submit when 4 digits entered.
  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      setSubmitting(true)
      const t = setTimeout(() => {
        submitBtnRef.current?.click()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [pin, submitting])

  // Defensive: if we haven't navigated after 10s, reset so user can retry.
  useEffect(() => {
    if (!submitting) return
    const t = setTimeout(() => {
      setSubmitting(false)
      setPin('')
    }, 10000)
    return () => clearTimeout(t)
  }, [submitting])

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
        className="absolute h-px w-px overflow-hidden border-0 p-0 opacity-0"
        autoFocus
      />

      {/* Hidden submit button — clicked programmatically when 4 digits land */}
      <button
        ref={submitBtnRef}
        type="submit"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      >
        Submit
      </button>

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

      {/* Visible Sign in button as ultimate fallback */}
      <button
        type="submit"
        disabled={submitting || pin.length !== 4}
        className="mt-6 rounded-lg bg-brand-forest px-6 py-2 text-sm font-medium text-brand-cream hover:bg-brand-olive disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
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
