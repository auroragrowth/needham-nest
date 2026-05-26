/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields containing commas
 * and escaped double-quotes. No streaming — assumes the whole CSV fits in
 * memory (fine for Monzo monthly exports which are typically <500 rows).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((f) => f !== '')) rows.push(row)
  }
  return rows
}

export type MonzoRow = {
  transaction_id: string | null
  date: string // ISO yyyy-mm-dd
  description: string
  amount: number // signed, positive = money in
  raw: Record<string, string>
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  // Try dd/mm/yyyy
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Last resort: let Date parse
  const t = Date.parse(raw)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

/**
 * Parse a Monzo-format CSV. Monzo's export columns vary slightly by year;
 * we look up by header name to be resilient.
 */
export function parseMonzoCsv(text: string): MonzoRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => h.trim().toLowerCase())
  const idx = (name: string) => headers.indexOf(name.toLowerCase())

  const iId = idx('transaction id')
  const iDate = idx('date')
  const iName = idx('name')
  const iDescription = idx('description')
  const iNotes = idx('notes and #tags')
  const iAmount = idx('amount')
  const iMoneyIn = idx('money in')
  const iMoneyOut = idx('money out')
  const iCategory = idx('category')

  const out: MonzoRow[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    if (!cells || cells.length === 0) continue

    const date = parseDate(iDate >= 0 ? cells[iDate] : '')
    if (!date) continue

    let amount = 0
    if (iAmount >= 0 && cells[iAmount]) {
      amount = Number(cells[iAmount].replace(/[^0-9.\-]/g, '')) || 0
    } else {
      const inAmt = iMoneyIn >= 0 ? Number(cells[iMoneyIn].replace(/[^0-9.\-]/g, '')) || 0 : 0
      const outAmt = iMoneyOut >= 0 ? Number(cells[iMoneyOut].replace(/[^0-9.\-]/g, '')) || 0 : 0
      amount = inAmt - outAmt
    }
    if (amount === 0) continue

    const name = (iName >= 0 && cells[iName]) || ''
    const desc = (iDescription >= 0 && cells[iDescription]) || ''
    const notes = (iNotes >= 0 && cells[iNotes]) || ''
    const category = (iCategory >= 0 && cells[iCategory]) || ''
    const description = [name, desc, notes].filter(Boolean).join(' · ') || category || '(unknown)'

    const transaction_id =
      iId >= 0 && cells[iId] ? cells[iId].trim() || null : null

    const raw: Record<string, string> = {}
    headers.forEach((h, i) => {
      raw[h] = cells[i] ?? ''
    })

    out.push({ transaction_id, date, description, amount, raw })
  }
  return out
}
