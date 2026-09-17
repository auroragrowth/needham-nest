import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The waste check every member of staff does before clocking out: confirm the
 * waste from this shift is logged, or that there wasn't any. One row per shift
 * (waste_confirmations), so it's each person's own check, not just the closer's.
 */

export type ShiftWaste = {
  /** The open shift, if they're clocked in. No shift means nothing to confirm. */
  shift: { id: string; clock_in: string } | null
  confirmed: boolean
  /** Waste this person logged during this shift. */
  mine: {
    id: string
    quantity: number
    wastage_reason: string | null
    notes: string | null
    wasted_at: string | null
    created_at: string
    item: string
    unit: string
  }[]
}

export async function getShiftWaste(profileId: string): Promise<ShiftWaste> {
  const admin = createAdminClient()
  const { data: shift } = await admin
    .from('time_logs')
    .select('id, clock_in')
    .eq('user_id', profileId)
    .is('clock_out', null)
    .maybeSingle()

  if (!shift) return { shift: null, confirmed: false, mine: [] }

  const [{ data: confirmation }, { data: rows }] = await Promise.all([
    admin.from('waste_confirmations').select('time_log_id').eq('time_log_id', shift.id).maybeSingle(),
    admin
      .from('stock_movements')
      .select('id, quantity, wastage_reason, notes, wasted_at, created_at, stock_items(name, unit)')
      .not('wastage_reason', 'is', null)
      .eq('user_id', profileId)
      .gte('created_at', shift.clock_in)
      .order('created_at'),
  ])

  const mine = (rows ?? []).map((r) => {
    const item = Array.isArray(r.stock_items) ? r.stock_items[0] : r.stock_items
    return {
      id: r.id as string,
      quantity: Number(r.quantity),
      wastage_reason: r.wastage_reason as string | null,
      notes: r.notes as string | null,
      wasted_at: r.wasted_at as string | null,
      created_at: r.created_at as string,
      item: item?.name ?? 'Unknown',
      unit: item?.unit ?? '',
    }
  })

  return { shift, confirmed: Boolean(confirmation), mine }
}

/** True when this person is clocked in and hasn't confirmed their waste yet. */
export function wasteBlocked(state: ShiftWaste): boolean {
  return Boolean(state.shift) && !state.confirmed
}
