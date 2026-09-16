/**
 * Read-only access for Nesty, the owner's desktop assistant.
 *
 * Nesty has its own token, NESTY_READ_TOKEN, separate from any login, and it
 * can only run the named reports in ./catalogue. Without the token set (at
 * least 32 characters) the endpoint is closed.
 */

/** Deliberately fails closed: no token, or a short one, means nobody gets in. */
export function nestyReadToken(): string | null {
  // Pasting into a dashboard easily picks up a stray space or newline.
  const token = process.env.NESTY_READ_TOKEN?.trim()
  return token && token.length >= 32 ? token : null
}

/** True only for `Authorization: Bearer <token>` with exactly the right token. */
export function bearerMatches(header: string | null, token: string): boolean {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/)
  if (!match) return false
  const given = match[1]
  // Length-independent compare, so a wrong token leaks nothing by timing.
  let diff = given.length ^ token.length
  for (let i = 0; i < token.length; i++) diff |= (given.charCodeAt(i) || 0) ^ token.charCodeAt(i)
  return diff === 0
}
