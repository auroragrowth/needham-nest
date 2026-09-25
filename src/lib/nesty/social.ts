import { randomUUID } from 'node:crypto'

/**
 * Posting to the café's Facebook Page and Instagram account, for the Social and
 * marketing agent (03). Only ever reached through the `social-post` action, which
 * runs after the owner clicks Apply in Nesty or approves the card on Mission Control.
 *
 * Posts go out through Composio, which holds the Facebook and Instagram sign-ins.
 * Settings (Vercel project variables):
 *   COMPOSIO_API_KEY               the Composio project API key
 *   COMPOSIO_FACEBOOK_ACCOUNT      the connected account id for the Needham Nest Page
 *   COMPOSIO_INSTAGRAM_ACCOUNT     the connected account id for @needhamnest
 *   FACEBOOK_PAGE_ID               the Page's numeric id
 *   INSTAGRAM_USER_ID              the Instagram business account's numeric id
 */

type Admin = { storage: { from(bucket: string): any } } // eslint-disable-line @typescript-eslint/no-explicit-any

export type Platform = 'facebook' | 'instagram'
export type Image = { base64: string; mimetype: string }
export type Posted = { platform: Platform; ok: boolean; id?: string; url?: string; detail: string }

const COMPOSIO = 'https://backend.composio.dev/api/v3.1/tools/execute/'

function setting(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set on the café app, so it can't post yet.`)
  return value
}

export function socialConfigured(platform: Platform): string | null {
  const needed = ['COMPOSIO_API_KEY', ...(platform === 'facebook'
    ? ['COMPOSIO_FACEBOOK_ACCOUNT', 'FACEBOOK_PAGE_ID']
    : ['COMPOSIO_INSTAGRAM_ACCOUNT', 'INSTAGRAM_USER_ID'])]
  const missing = needed.filter(n => !process.env[n]?.trim())
  return missing.length ? `${missing.join(', ')} not set` : null
}

/** One Composio tool call. Returns the tool's data, or throws with its error in plain words. */
async function run(slug: string, account: string, args: Record<string, unknown>): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const response = await fetch(COMPOSIO + slug, {
    method: 'POST',
    headers: { 'x-api-key': setting('COMPOSIO_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ connected_account_id: account, arguments: args }),
    signal: AbortSignal.timeout(90_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body || body.successful === false || body.error) {
    const why = body?.error?.message ?? body?.error ?? body?.message ?? `HTTP ${response.status}`
    throw new Error(typeof why === 'string' ? why : JSON.stringify(why))
  }
  const data = body.data ?? {}
  return data.response_data ?? data
}

/** Puts the photo somewhere Facebook and Instagram can fetch it. */
export async function uploadImage(admin: Admin, image: Image): Promise<string> {
  const ext = image.mimetype === 'image/png' ? 'png' : 'jpg'
  const now = new Date()
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`
  const bytes = Buffer.from(image.base64, 'base64')
  const { error } = await admin.storage.from('social').upload(path, bytes, { contentType: image.mimetype, upsert: false })
  if (error) throw new Error(`the photo didn't upload: ${error.message}`)
  return admin.storage.from('social').getPublicUrl(path).data.publicUrl as string
}

export async function postFacebook(caption: string, imageUrl: string | null): Promise<Posted> {
  try {
    const account = setting('COMPOSIO_FACEBOOK_ACCOUNT')
    const page_id = setting('FACEBOOK_PAGE_ID')
    const created = imageUrl
      ? await run('FACEBOOK_CREATE_PHOTO_POST', account, { page_id, url: imageUrl, message: caption })
      : await run('FACEBOOK_CREATE_POST', account, { page_id, message: caption })
    const id = String(created.post_id ?? created.id ?? '')
    if (!id) return { platform: 'facebook', ok: false, detail: 'Facebook took it but gave no post id. Check the Page before trying again.' }
    // Read it back: only report it posted if Facebook shows it.
    const check = await run('FACEBOOK_GET_POST', account, { post_id: id, fields: 'id,permalink_url,message' }).catch(() => null)
    const url = check?.permalink_url ?? `https://www.facebook.com/${id}`
    return { platform: 'facebook', ok: true, id, url, detail: check ? 'Posted on Facebook.' : 'Posted on Facebook (not yet showing when checked).' }
  } catch (e) {
    return { platform: 'facebook', ok: false, detail: `Facebook: ${e instanceof Error ? e.message : e}` }
  }
}

export async function postInstagram(caption: string, imageUrl: string): Promise<Posted> {
  try {
    const account = setting('COMPOSIO_INSTAGRAM_ACCOUNT')
    const ig_user_id = setting('INSTAGRAM_USER_ID')
    const container = await run('INSTAGRAM_POST_IG_USER_MEDIA', account, { ig_user_id, image_url: imageUrl, caption })
    const creation_id = String(container.id ?? '')
    if (!creation_id) return { platform: 'instagram', ok: false, detail: 'Instagram didn\'t accept the photo.' }
    const published = await run('INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH', account, { ig_user_id, creation_id, max_wait_seconds: 60 })
    const id = String(published.id ?? '')
    if (!id) return { platform: 'instagram', ok: false, detail: 'Instagram didn\'t publish it. Check the account before trying again.' }
    const check = await run('INSTAGRAM_GET_IG_MEDIA', account, { ig_media_id: id, fields: 'id,permalink' }).catch(() => null)
    return { platform: 'instagram', ok: true, id, url: check?.permalink ?? undefined, detail: 'Posted on Instagram.' }
  } catch (e) {
    return { platform: 'instagram', ok: false, detail: `Instagram: ${e instanceof Error ? e.message : e}` }
  }
}
