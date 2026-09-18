import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushover, type AlertRun } from './long-shifts'

/**
 * Tells the owner's phone when selling on the till runs something out.
 *
 * Run-outs are opened as the till's sales come off the shelves
 * (apply_till_usage → note_stock_level): 'out' when the last of it went, and
 * 'short' when the till sold more than the iPad said there was — below zero, if
 * stock were allowed there, which usually means a count was missed. One open
 * run-out per item, so each pushes once; it closes itself when the item has
 * stock again. Nesty lists them too (nesty_run_outs).
 */

type OpenRunOut = {
  id: string
  kind: 'out' | 'short'
  short_by: number
  stock_items: { name: string; unit: string } | null
}

function amount(quantity: number, unit: string): string {
  const n = Math.round(Number(quantity) * 100) / 100
  return unit === 'ea' ? `${n}` : `${n} ${unit}`
}

export function describeRunOut(r: { kind: 'out' | 'short'; short_by: number; name: string; unit: string }) {
  return r.kind === 'short'
    ? {
        title: `Stock short: ${r.name}`,
        message:
          `The till has sold ${amount(r.short_by, r.unit)} more than the iPad had. ` +
          `Probably a count or a delivery that wasn't logged — worth counting ${r.name}.`,
      }
    : {
        title: `Sold out: ${r.name}`,
        message: `The till has sold the last of it. The iPad shows none in the café, kitchen or storage.`,
      }
}

export async function pushRunOuts(): Promise<AlertRun> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('stock_run_outs')
    .select('id, kind, short_by, stock_items(name, unit)')
    .is('resolved_at', null)
    .is('pushed_at', null)
  if (error) throw new Error(error.message)

  const open = (data ?? []) as unknown as OpenRunOut[]
  const run: AlertRun = { checked: open.length, alerted: [], failed: [] }
  for (const r of open) {
    const name = r.stock_items?.name ?? 'an item'
    const { title, message } = describeRunOut({ kind: r.kind, short_by: r.short_by, name, unit: r.stock_items?.unit ?? 'ea' })
    if (!(await sendPushover(title, message))) {
      run.failed.push(name)
      continue
    }
    // Only after Pushover accepted it, so a failed send retries next run.
    await admin.from('stock_run_outs').update({ pushed_at: new Date().toISOString() }).eq('id', r.id).is('pushed_at', null)
    run.alerted.push(name)
  }
  return run
}
