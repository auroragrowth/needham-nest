import Anthropic from '@anthropic-ai/sdk'
import heicConvert from 'heic-convert'

/**
 * Calls Claude to extract structured invoice data from a PDF/JPG/PNG.
 *
 * Returns null fields where the model can't read them, rather than
 * guessing — Paul confirms / corrects in the UI before the row lands
 * in the expenses ledger.
 */
export type ExtractedInvoice = {
  date: string | null // YYYY-MM-DD
  supplier: string | null
  amount: number | null // GBP, inclusive of VAT
  amount_net: number | null
  vat_amount: number | null
  vat_rate: number | null // 0, 0.05, 0.20 etc.
  reference: string | null // invoice number
  notes: string | null // free-text summary of line items
  confidence: 'high' | 'medium' | 'low'
}

const SYSTEM_PROMPT = `You are an accounts assistant for a UK cafe. The user uploads a supplier invoice (PDF, JPG, or PNG photo from an iPhone). Extract the key fields and return JSON only.

Always return values in GBP. Amounts are the gross amount the cafe owes (or paid). If you can see a VAT breakdown, capture net + VAT separately.

Return null for any field you can't read confidently. Don't guess.`

const SCHEMA_INSTRUCTION = `Reply with ONLY a JSON object matching this TypeScript type:

{
  date: string | null,         // invoice date, ISO YYYY-MM-DD
  supplier: string | null,     // who the cafe owes
  amount: number | null,       // gross total in GBP
  amount_net: number | null,   // net amount before VAT
  vat_amount: number | null,   // VAT charged
  vat_rate: number | null,     // 0 / 0.05 / 0.20 etc. — null if unclear
  reference: string | null,    // invoice number / reference
  notes: string | null,        // 1-line summary of what was bought
  confidence: "high" | "medium" | "low"
}

No prose. No markdown fences. JSON only.`

function mediaTypeFor(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'png') return 'image/png'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

export async function extractInvoice(
  filename: string,
  bytes: ArrayBuffer,
): Promise<ExtractedInvoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set in the environment — add it on Vercel.',
    )
  }
  const client = new Anthropic({ apiKey })

  let workingBytes: ArrayBuffer = bytes
  let mediaType = mediaTypeFor(filename)

  // iPhone HEIC files: Claude can't read them, convert to JPEG first.
  if (mediaType === 'image/heic' || mediaType === 'image/heif') {
    const inputBuffer = new Uint8Array(bytes)
    const jpegBuf = await (
      heicConvert as unknown as (opts: {
        buffer: Uint8Array
        format: 'JPEG'
        quality: number
      }) => Promise<ArrayBuffer>
    )({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.85,
    })
    workingBytes = jpegBuf
    mediaType = 'image/jpeg'
  }

  const base64 = Buffer.from(workingBytes).toString('base64')
  const isPdf = mediaType === 'application/pdf'

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          isPdf
            ? {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              }
            : {
                type: 'image',
                source: {
                  type: 'base64',
                  // HEIC already converted to JPEG above; remaining types
                  // pass through directly.
                  media_type: mediaType as
                    | 'image/jpeg'
                    | 'image/png'
                    | 'image/gif'
                    | 'image/webp',
                  data: base64,
                },
              },
          { type: 'text', text: SCHEMA_INSTRUCTION },
        ],
      },
    ],
  })

  const textBlock = message.content.find((c) => c.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content')
  }

  // Claude sometimes wraps JSON in markdown fences despite being told not to.
  // Strip ```json ... ``` (or ``` ... ```) before parsing.
  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()

  let parsed: ExtractedInvoice
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(
      `Claude returned non-JSON. Raw: ${textBlock.text.slice(0, 200)}`,
    )
  }
  return parsed
}
