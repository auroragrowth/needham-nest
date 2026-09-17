import { NextResponse } from 'next/server'
import { breakStatusesNow } from '@/lib/breaks/on-shift'

export const dynamic = 'force-dynamic'

/**
 * How many people on shift are due a break, for the strip on the PIN screen.
 *
 * Public (the PIN screen has no session), so it returns counts only: no names,
 * no times. Names show once someone enters their PIN.
 */
export async function GET() {
  const shifts = await breakStatusesNow()
  const soon = shifts.filter((s) => s.status === 'soon').length
  const due = shifts.filter((s) => s.status === 'due').length
  return NextResponse.json({ soon, due }, { headers: { 'cache-control': 'no-store' } })
}
