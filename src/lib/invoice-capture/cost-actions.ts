'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { decideCosts, mapLine } from './costs'

/**
 * The owner's decisions on /owner/costs. Only an owner can approve or reject a
 * cost or map a line; the till records who, by name.
 */
async function owner() {
  const session = await getSession()
  if (!session || session.role !== 'owner') redirect('/login')
  return session
}

function back(tab: string, notice: string): never {
  revalidatePath('/owner/costs')
  redirect(`/owner/costs?tab=${tab}&notice=${encodeURIComponent(notice)}`)
}

export async function decideAction(formData: FormData) {
  const session = await owner()
  const ids = formData.getAll('ids').map(String).filter(Boolean)
  const decision = formData.get('decision') === 'rejected' ? 'rejected' : 'approved'
  if (!ids.length) back('approve', 'Tick at least one cost first.')
  let done = 0
  try {
    done = (await decideCosts(ids, decision, session.name)).done
  } catch (e) {
    back('approve', `The till said: ${e instanceof Error ? e.message : String(e)}`)
  }
  back('approve', `${done} ${done === 1 ? 'cost' : 'costs'} ${decision}.`)
}

export async function mapAction(formData: FormData) {
  const session = await owner()
  const supplierId = String(formData.get('supplier_id') ?? '')
  const description = String(formData.get('description') ?? '')
  const target = String(formData.get('target') ?? '')
  const packQty = Number(formData.get('pack_size_qty'))

  if (!target) back('map', 'Pick what that line is first.')
  const ignore = target === 'ignore'
  const [kind, id] = target.split(':')
  if (!ignore && !(packQty > 0)) back('map', `How much is in one pack of "${description}"?`)

  let result: { lines: number; proposed: number } | null = null
  try {
    result = await mapLine({
      supplier_id: supplierId,
      description,
      ingredient_id: kind === 'ingredient' ? id : null,
      supply_id: kind === 'supply' ? id : null,
      ignore,
      pack_size_qty: ignore ? null : packQty,
      mapped_by: session.name,
    })
  } catch (e) {
    back('map', `The till said: ${e instanceof Error ? e.message : String(e)}`)
  }
  back(
    'map',
    ignore
      ? `"${description}" set aside as not stock.`
      : `"${description}" mapped. ${result?.lines ?? 0} lines matched${result?.proposed ? ', and a cost is waiting for you' : ''}.`,
  )
}
