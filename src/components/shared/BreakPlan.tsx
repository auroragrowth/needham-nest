import { createAdminClient } from '@/lib/supabase/admin'
import { breakPlanMessage } from '@/lib/breaks/status'

/**
 * Shown straight after clocking in: when this person's break is due, using
 * their published rota end today if they have one.
 */
export async function BreakPlan({
  profileId,
  clockIn,
  youngWorker,
}: {
  profileId: string
  clockIn: string
  youngWorker: boolean
}) {
  const today = new Date(clockIn).toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const { data: rota } = await createAdminClient()
    .from('rota_shifts')
    .select('end_time')
    .eq('staff_user_id', profileId)
    .eq('date', today)
    .eq('published', true)
    .order('end_time', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <section className="mb-4 rounded-2xl border-2 border-brand-teal bg-brand-teal/10 p-5 text-brand-forest">
      <p className="text-lg font-semibold">☕ Your break today</p>
      <p className="mt-1 text-sm">{breakPlanMessage({ clockIn, rotaEnd: rota?.end_time ?? null, youngWorker })}</p>
    </section>
  )
}
