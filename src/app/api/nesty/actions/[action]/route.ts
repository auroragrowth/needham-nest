import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bearerMatches } from '@/lib/nesty/access'
import { ACTIONS, ActionError, ownerProfileId } from '@/lib/nesty/actions'

export const dynamic = 'force-dynamic'
// Posting to Facebook and Instagram can take a minute.
export const maxDuration = 120

/**
 * Applies one change the owner approved in Nesty. POST only, and only with
 * NESTY_WRITE_TOKEN: a separate token from the read-only reports, sent by the
 * Nesty app when the owner clicks Apply, never available to its model.
 *
 *   POST /api/nesty/actions/leave-decide   {"leave_id":"…","decision":"approved"}
 */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const token = process.env.NESTY_WRITE_TOKEN?.trim()
  if (!token || token.length < 32) {
    return json({ ok: false, detail: 'NESTY_WRITE_TOKEN is not set, so Nesty cannot make changes.' }, 503)
  }
  if (!bearerMatches(request.headers.get('authorization'), token)) {
    return json({ ok: false, detail: 'Not allowed' }, 401)
  }

  const { action } = await params
  const run = ACTIONS[action]
  if (!run) return json({ ok: false, detail: `No action called "${action}"`, actions: Object.keys(ACTIONS) }, 404)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, detail: 'Send the action’s details as a JSON object.' }, 400)
  }

  try {
    const admin = createAdminClient()
    const detail = await run(admin, await ownerProfileId(admin), body)
    return json({ ok: true, detail })
  } catch (e) {
    if (e instanceof ActionError) return json({ ok: false, detail: e.message }, 409)
    return json({ ok: false, detail: `The café app couldn't make the change: ${e instanceof Error ? e.message : e}` }, 500)
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })
}
