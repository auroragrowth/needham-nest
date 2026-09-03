import Link from 'next/link'

/**
 * Clickable "Have your say" banner for the staff hub. Tapping it opens the
 * anonymous feedback form. No completion tracking — that would need a
 * per-person flag, which would weaken the anonymity.
 */
export function FeedbackBanner() {
  return (
    <Link
      href="/staff/feedback"
      aria-label="Have your say — give anonymous feedback"
      className="mt-4 flex items-center justify-between gap-4 rounded-2xl border-2 border-brand-amber bg-brand-forest p-5 text-brand-cream transition active:scale-[0.99] hover:bg-brand-olive"
    >
      <span className="min-w-0">
        <span className="block text-lg font-semibold">Have your say</span>
        <span className="mt-1 block text-sm text-brand-cream/80">
          Tap to give your anonymous feedback. It only takes a few minutes.
        </span>
      </span>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-amber text-xl text-brand-amber"
      >
        →
      </span>
    </Link>
  )
}
