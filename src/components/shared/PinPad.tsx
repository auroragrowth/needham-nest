'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  action: (formData: FormData) => Promise<void>
}

export function PinPad({ action }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
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

  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      setSubmitting(true)
      const fd = new FormData()
      fd.set('pin', pin)
      startTransition(async () => {
        try {
          await action(fd)
        } finally {
          setSubmitting(false)
          setPin('')
          router.refresh()
        }
      })
    }
  }, [pin, submitting, action, router])

  // Capture physical keyboard input.
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
    <form ref={formRef} action={action} className="flex flex-col items-center">
      <input type="hidden" name="pin" value={pin} />

      <div className="flex gap-3" aria-label={`PIN: ${pin.length} of 4 digits entered`}>
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
          <PadButton key={d} onClick={() => press(d)} disabled={submitting}>
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
        <PadButton onClick={() => press('0')} disabled={submitting}>
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
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-20 w-20 rounded-2xl border border-brand-sage/40 bg-white text-3xl font-medium text-brand-forest shadow-sm transition active:scale-95 hover:bg-brand-sage/10 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
