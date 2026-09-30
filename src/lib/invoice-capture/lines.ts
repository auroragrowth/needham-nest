import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'
import { linesBacklog, postLines, type BacklogInvoice, type DocumentKind, type LineIn } from './costs'

/**
 * Agent 11: reading the lines off confirmed invoices, so each one can become a
 * unit cost for Paul or Ben to approve.
 *
 * The header (number, date, totals) was already read into the expenses when
 * the photo came in. This reads what was bought: each line's description, pack
 * size and price. The till then matches lines it has seen before and proposes
 * costs; anything new waits on /owner/costs to be mapped once by a person.
 *
 * Nothing is guessed: a price or pack size that can't be read comes back null,
 * and a picking note with no prices is logged as a gap, not a cost.
 */

const SYSTEM = `You read supplier invoices, delivery notes and till receipts for a small UK café, and list what was bought, line by line, so the café can work out what each ingredient costs.

Rules:
- One entry per purchased line. Skip totals, sub-totals, VAT summaries, delivery charges, deposits, bag charges, payment lines, loyalty points and change given.
- description: the product text exactly as printed on that line (no codes, no prices).
- pack_raw: the pack size as printed, if any (e.g. "12x500g", "2.27L", "4 pint", "x6"). Null if none.
- pack_size_qty and pack_size_unit: how much is in ONE pack, in the simplest unit: g for weight, ml for liquid, each for counted things. So "12x500g" is 6000 g, "4 pint" is 2272 ml, "2.27L" is 2270 ml, "box of 100" is 100 each, a single loaf is 1 each. Null if you can't tell.
- qty: how many packs were bought on that line. 1 if it isn't shown.
- pack_price: price of ONE pack in pence, as actually paid (after any line discount, including VAT; the café isn't VAT registered). Null if there is no price.
- line_total: the line's total in pence as printed. Null if none.
- confidence: 0 to 1, how sure you are of that line's price and pack size.
- kind: "invoice" for an invoice or receipt with prices; "picking_note" for a delivery or picking note with no prices; "unreadable" if you can't read the lines at all.

Never guess a number. Null is always better than a plausible wrong value.`

const SHAPE = `Reply with ONLY this JSON, no prose and no fences:
{"kind":"invoice"|"picking_note"|"unreadable","note":string|null,"lines":[{"description":string,"pack_raw":string|null,"pack_size_qty":number|null,"pack_size_unit":"g"|"ml"|"each"|null,"qty":number|null,"pack_price":number|null,"line_total":number|null,"confidence":number|null}]}`

type Read = { kind: DocumentKind; note: string | null; lines: LineIn[] }

function mediaTypeFor(name: string, contentType: string): string {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'pdf' || contentType.includes('pdf')) return 'application/pdf'
  if (ext === 'png' || contentType.includes('png')) return 'image/png'
  if (ext === 'heic' || ext === 'heif' || contentType.includes('heic') || contentType.includes('heif')) return 'image/heic'
  if (ext === 'webp' || contentType.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

async function toReadable(bytes: ArrayBuffer, mediaType: string) {
  if (mediaType !== 'image/heic') return { bytes, mediaType }
  const jpeg = await (
    heicConvert as unknown as (o: { buffer: Uint8Array; format: 'JPEG'; quality: number }) => Promise<ArrayBuffer>
  )({ buffer: new Uint8Array(bytes), format: 'JPEG', quality: 0.85 })
  return { bytes: jpeg, mediaType: 'image/jpeg' }
}

/** The stronger model first; the one the header reader uses if it isn't available. */
const MODELS = [process.env.INVOICE_LINES_MODEL?.trim() || 'claude-sonnet-5-5', 'claude-haiku-4-5-20251001']

export async function readLines(invoice: BacklogInvoice): Promise<Read> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.')
  if (!invoice.url) throw new Error('The till gave no link to the file.')

  const response = await fetch(invoice.url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Could not fetch the file (${response.status}).`)
  const raw = await response.arrayBuffer()
  const { bytes, mediaType } = await toReadable(raw, mediaTypeFor(invoice.file_name ?? '', response.headers.get('content-type') ?? ''))
  const data = Buffer.from(bytes).toString('base64')

  const client = new Anthropic({ apiKey })
  const context = `Supplier on file: ${invoice.supplier ?? 'not known'}. Invoice number: ${invoice.invoice_no ?? 'not read'}. Date: ${invoice.invoice_date ?? 'not read'}.`

  let lastError: unknown = null
  for (const model of MODELS) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              mediaType === 'application/pdf'
                ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
                : { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data } },
              { type: 'text', text: `${context}\n\n${SHAPE}` },
            ],
          },
        ],
      })
      const text = message.content.find((c) => c.type === 'text')
      if (!text || text.type !== 'text') throw new Error('No text came back.')
      return clean(JSON.parse(text.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')))
    } catch (e) {
      lastError = e
      // Only a missing model is worth trying the next one for.
      const status = (e as { status?: number }).status
      if (status !== 404 && status !== 400) break
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function pence(v: unknown): number | null {
  const n = num(v)
  return n == null ? null : Math.round(n)
}

function clean(parsed: unknown): Read {
  const p = (parsed ?? {}) as { kind?: string; note?: string; lines?: unknown[] }
  const kind: DocumentKind =
    p.kind === 'picking_note' || p.kind === 'unreadable' ? p.kind : 'invoice'
  const lines: LineIn[] = (Array.isArray(p.lines) ? p.lines : [])
    .map((l) => l as Record<string, unknown>)
    .filter((l) => typeof l.description === 'string' && l.description.trim())
    .map((l) => {
      const unit = l.pack_size_unit === 'g' || l.pack_size_unit === 'ml' || l.pack_size_unit === 'each' ? l.pack_size_unit : null
      const qty = num(l.qty)
      return {
        description: String(l.description).trim(),
        pack_raw: typeof l.pack_raw === 'string' && l.pack_raw.trim() ? l.pack_raw.trim() : null,
        pack_size_qty: unit ? num(l.pack_size_qty) : null,
        pack_size_unit: unit,
        qty: qty && qty > 0 ? qty : null,
        // A picking note has no prices; never let one through as a cost.
        pack_price: kind === 'picking_note' ? null : pence(l.pack_price),
        line_total: kind === 'picking_note' ? null : pence(l.line_total),
        confidence: num(l.confidence),
      }
    })
  return { kind, note: typeof p.note === 'string' ? p.note : null, lines }
}

export type LinesRunSummary = { read: number; failed: number; remaining: number; proposed: number; toMap: number; errors: string[] }

/** Read the next few invoices' lines and hand them to the till. One at a time. */
export async function readLinesBacklog(n = 4): Promise<LinesRunSummary> {
  const summary: LinesRunSummary = { read: 0, failed: 0, remaining: 0, proposed: 0, toMap: 0, errors: [] }
  const { invoices, remaining } = await linesBacklog(n)
  summary.remaining = remaining
  for (const invoice of invoices) {
    const label = [invoice.supplier, invoice.invoice_no ?? invoice.file_name].filter(Boolean).join(' ') || invoice.id
    try {
      const read = await readLines(invoice)
      const result = await postLines(invoice.id, read.kind, read.lines, read.note)
      summary.read += 1
      summary.remaining -= 1
      summary.proposed += result.proposed ?? 0
      summary.toMap += result.to_map ?? 0
    } catch (e) {
      // Left unread, so the next run tries again.
      summary.failed += 1
      summary.errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return summary
}
