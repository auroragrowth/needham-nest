import { randomUUID } from 'node:crypto'

/**
 * Posting to the café's Facebook Page and Instagram account, for the Social and
 * marketing agent (03). Only ever reached through the `social-post` action, which
 * runs after the owner clicks Apply in Nesty or approves the card on Mission Control.
 *
 * Posts go straight to Meta's Graph API with a system user's token from the
 * Needham Nest business portfolio. Settings (Vercel project variables):
 *   META_SYSTEM_TOKEN   the system user's token (never expires; NeedhamNest page and
 *                       Instagram assigned to it)
 *   FACEBOOK_PAGE_ID    the NeedhamNest page's numeric id
 * The Instagram account is the one linked to the page, looked up each time.
 */

type Admin = { storage: { from(bucket: string): any } } // eslint-disable-line @typescript-eslint/no-explicit-any
type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type Platform = 'facebook' | 'instagram'
export type Image = { base64: string; mimetype: string }
export type Posted = { platform: Platform; ok: boolean; id?: string; url?: string; detail: string }

const GRAPH = 'https://graph.facebook.com/v23.0/'

export function socialConfigured(): string | null {
  const missing = ['META_SYSTEM_TOKEN', 'FACEBOOK_PAGE_ID'].filter(n => !process.env[n]?.trim())
  return missing.length ? `${missing.join(', ')} not set` : null
}

async function graph(path: string, token: string, body?: Record<string, string>): Promise<Json> {
  const url = new URL(GRAPH + path)
  const init: RequestInit = { signal: AbortSignal.timeout(60_000) }
  if (body) {
    init.method = 'POST'
    init.body = new URLSearchParams({ ...body, access_token: token })
  } else {
    url.searchParams.set('access_token', token)
  }
  const response = await fetch(url, init)
  const data = (await response.json().catch(() => null)) as Json | null
  if (!response.ok || !data || data.error) throw new Error(data?.error?.message ?? `HTTP ${response.status}`)
  return data
}

/** The page's own token and its linked Instagram account, from the system user's token. */
async function page(): Promise<{ id: string; token: string; instagram: string | null }> {
  const id = process.env.FACEBOOK_PAGE_ID!.trim()
  const data = await graph(`${id}?fields=access_token,instagram_business_account`, process.env.META_SYSTEM_TOKEN!.trim())
  if (!data.access_token) throw new Error('the system user has no access to the NeedhamNest page')
  return { id, token: data.access_token, instagram: data.instagram_business_account?.id ?? null }
}

/** Puts the photo somewhere Facebook and Instagram can fetch it. */
export async function uploadImage(admin: Admin, image: Image): Promise<string> {
  const ext = image.mimetype === 'image/png' ? 'png' : 'jpg'
  const now = new Date()
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`
  const { error } = await admin.storage.from('social').upload(path, Buffer.from(image.base64, 'base64'), { contentType: image.mimetype, upsert: false })
  if (error) throw new Error(`the photo didn't upload: ${error.message}`)
  return admin.storage.from('social').getPublicUrl(path).data.publicUrl as string
}

export async function postFacebook(caption: string, imageUrl: string | null): Promise<Posted> {
  try {
    const p = await page()
    const created = imageUrl
      ? await graph(`${p.id}/photos`, p.token, { url: imageUrl, message: caption })
      : await graph(`${p.id}/feed`, p.token, { message: caption })
    const id = String(created.post_id ?? created.id ?? '')
    if (!id) return { platform: 'facebook', ok: false, detail: 'Facebook took it but gave no post id. Check the page before trying again.' }
    // Read it back: only report it posted if Facebook shows it.
    const check = await graph(`${id}?fields=permalink_url`, p.token).catch(() => null)
    return { platform: 'facebook', ok: true, id, url: check?.permalink_url ?? `https://www.facebook.com/${id}`, detail: 'Posted on Facebook.' }
  } catch (e) {
    return { platform: 'facebook', ok: false, detail: `Facebook: ${e instanceof Error ? e.message : e}` }
  }
}

export async function postInstagram(caption: string, imageUrl: string): Promise<Posted> {
  try {
    const p = await page()
    if (!p.instagram) return { platform: 'instagram', ok: false, detail: 'Instagram: no Instagram account is linked to the NeedhamNest page.' }
    const container = await graph(`${p.instagram}/media`, p.token, { image_url: imageUrl, caption })
    // Instagram fetches the photo first; wait until it's ready (usually a second or two).
    for (let i = 0; i < 20; i++) {
      const s = await graph(`${container.id}?fields=status_code`, p.token)
      if (s.status_code === 'FINISHED') break
      if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error("Instagram couldn't use the photo (it may be the wrong shape: square or 4:5 portrait works)")
      await new Promise(r => setTimeout(r, 2000))
    }
    const published = await graph(`${p.instagram}/media_publish`, p.token, { creation_id: String(container.id) })
    const check = await graph(`${published.id}?fields=permalink`, p.token).catch(() => null)
    return { platform: 'instagram', ok: true, id: String(published.id), url: check?.permalink, detail: 'Posted on Instagram.' }
  } catch (e) {
    return { platform: 'instagram', ok: false, detail: `Instagram: ${e instanceof Error ? e.message : e}` }
  }
}
