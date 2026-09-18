'use client'

import { useFormStatus } from 'react-dom'

/**
 * A form's submit button that shows it's working. Server actions give no
 * feedback of their own, so a slow one (matching the whole bank feed) looks
 * dead and gets pressed again and again. While the form is submitting this is
 * disabled and reads "Working…".
 */
export function PendingButton({
  children,
  className,
  title,
  pendingText = 'Working…',
}: {
  children: React.ReactNode
  className?: string
  title?: string
  pendingText?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} disabled:cursor-wait disabled:opacity-60`}
      title={title}
    >
      {pending ? pendingText : children}
    </button>
  )
}
