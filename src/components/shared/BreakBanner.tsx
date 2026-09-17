import { startBreak } from '@/lib/time-logs/actions'
import { breakStatusFor } from '@/lib/breaks/on-shift'
import { formatMinutes } from '@/lib/breaks/status'

/**
 * Reminds the person logged in to take their break: from an hour before the
 * legal point, and urgently once past it. Shows nothing if they're not on
 * shift, are on a break, or have already had enough break.
 */
export async function BreakBanner({ profileId }: { profileId: string }) {
  const shift = await breakStatusFor(profileId)
  if (!shift || (shift.status !== 'soon' && shift.status !== 'due')) return null

  const onShift = formatMinutes(shift.shiftMinutes)
  const legal = formatMinutes(shift.legalAfterMinutes)
  const need = shift.requiredMinutes - shift.breakMinutes
  const had = shift.breakMinutes > 0 ? ` You've had ${shift.breakMinutes} minutes so far.` : ''
  const due = shift.status === 'due'

  return (
    <section
      role="alert"
      className={`mt-4 rounded-2xl border-2 p-5 ${
        due ? 'border-red-600 bg-red-50 text-red-800' : 'border-brand-amber bg-brand-amber/10 text-brand-forest'
      }`}
    >
      <p className="text-lg font-semibold">{due ? 'Break overdue' : 'Break due soon'}</p>
      <p className="mt-1 text-sm">
        {due
          ? `You're past ${legal} on shift (${onShift}) without your ${shift.requiredMinutes}-minute break. Please take ${need} minutes now.${had}`
          : `You've been on shift ${onShift} without a break. Take your ${shift.requiredMinutes}-minute break before ${legal}.${had}`}
      </p>
      <form action={startBreak} className="mt-3">
        <button
          type="submit"
          className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition active:scale-[0.98] ${
            due ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-forest text-brand-cream hover:bg-brand-olive'
          }`}
        >
          Go on break
        </button>
      </form>
    </section>
  )
}
