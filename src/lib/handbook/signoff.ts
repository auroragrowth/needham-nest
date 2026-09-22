import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Handbook sign-off rounds. Everyone listed in a round opens every live
 * handbook article, taps "I have read it", then signs and dates. The daily
 * reminder email is the Supabase edge function `handbook-reminders`.
 */

export const SIGNOFF_PATH = '/staff/handbook-signoff'

/** Today's date in the café's timezone, as YYYY-MM-DD. */
export function londonToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10))
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

export function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  })
}

export type SignoffRow = {
  id: string
  round_id: string
  read_confirmed_at: string | null
  signed_name: string | null
  signature_data: string | null
  signed_on: string | null
  signed_at: string | null
}

export type MySignoff = {
  round: { id: string; title: string; started_on: string; due_on: string }
  row: SignoffRow
  articles: Array<{ id: string; title: string; category: string | null }>
  readIds: Set<string>
}

/** The caller's place in the current round, or null if they're not in one. */
export async function getMySignoff(profileId: string): Promise<MySignoff | null> {
  const admin = createAdminClient()
  const today = londonToday()
  const { data: round } = await admin
    .from('handbook_signoff_rounds')
    .select('id, title, started_on, due_on')
    .eq('active', true)
    .lte('started_on', today)
    .order('started_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!round) return null

  const [{ data: row }, { data: articles }, { data: reads }] = await Promise.all([
    admin
      .from('handbook_signoffs')
      .select('id, round_id, read_confirmed_at, signed_name, signature_data, signed_on, signed_at')
      .eq('round_id', round.id)
      .eq('profile_id', profileId)
      .maybeSingle(),
    admin
      .from('handbook_articles')
      .select('id, title, category')
      .eq('active', true)
      .order('category')
      .order('sort_order')
      .order('title'),
    admin
      .from('handbook_reads')
      .select('article_id')
      .eq('round_id', round.id)
      .eq('profile_id', profileId),
  ])
  if (!row) return null

  return {
    round,
    row: row as SignoffRow,
    articles: articles ?? [],
    readIds: new Set((reads ?? []).map((r) => r.article_id as string)),
  }
}

/** Notes that this person has opened an article, if they have a sign-off still to do. */
export async function recordRead(profileId: string, articleId: string): Promise<MySignoff | null> {
  const mine = await getMySignoff(profileId)
  if (!mine || mine.row.signed_at) return mine
  if (!mine.readIds.has(articleId)) {
    const admin = createAdminClient()
    await admin
      .from('handbook_reads')
      .upsert(
        { round_id: mine.round.id, profile_id: profileId, article_id: articleId },
        { onConflict: 'round_id,profile_id,article_id', ignoreDuplicates: true },
      )
    mine.readIds.add(articleId)
  }
  return mine
}
