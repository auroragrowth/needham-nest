import Link from 'next/link'
import { daysBetween, getMySignoff, londonToday, SIGNOFF_PATH } from '@/lib/handbook/signoff'

/**
 * "Read and sign the handbook" prompt on the staff and manager hubs. Shows
 * until the person has signed, with how far they've got and the days left.
 */
export async function HandbookSignoffBanner({ profileId }: { profileId: string }) {
  const mine = await getMySignoff(profileId)
  if (!mine || mine.row.signed_at) return null

  const read = mine.articles.filter((a) => mine.readIds.has(a.id)).length
  const total = mine.articles.length
  const daysLeft = daysBetween(londonToday(), mine.round.due_on)
  const overdue = daysLeft < 0

  const next = !mine.row.read_confirmed_at
    ? read === total
      ? 'All read. Tap to confirm and sign.'
      : `${read} of ${total} sections read.`
    : 'All read ✓ Just sign and date it now.'

  const when = overdue
    ? `${-daysLeft} day${daysLeft === -1 ? '' : 's'} overdue`
    : daysLeft === 0
      ? 'Due today'
      : daysLeft === 1
        ? 'Due tomorrow'
        : `${daysLeft} days left`

  return (
    <Link
      href={SIGNOFF_PATH}
      aria-label="Read and sign the staff handbook"
      className={`mt-4 flex items-center justify-between gap-4 rounded-2xl border-2 p-5 transition active:scale-[0.99] ${
        overdue
          ? 'border-brand-amber bg-brand-amber/20 text-brand-forest hover:bg-brand-amber/30'
          : 'border-brand-amber bg-brand-forest text-brand-cream hover:bg-brand-olive'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-lg font-semibold">📖 Read and sign the handbook</span>
        <span className={`mt-1 block text-sm ${overdue ? 'text-brand-forest' : 'text-brand-cream/80'}`}>
          {next} {when}.
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
