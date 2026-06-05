/**
 * Deterministic colour for a profile id. Same id always returns the same
 * HSL palette so Vic / staff see consistent colours across pages.
 *
 * Returns four shades calibrated to read well against the cream background.
 */
export function colourForProfile(id: string): {
  bg: string
  border: string
  text: string
  dot: string
} {
  let hash = 5381
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) + hash + id.charCodeAt(i)
  }
  const hue = Math.abs(hash) % 360
  // Step through a small saturation set so adjacent IDs don't all look the same
  const sat = 65 + (Math.abs(hash >> 8) % 20) // 65..84
  return {
    bg: `hsl(${hue}, ${sat}%, 90%)`,
    border: `hsl(${hue}, ${sat - 10}%, 50%)`,
    text: `hsl(${hue}, ${sat - 5}%, 25%)`,
    dot: `hsl(${hue}, ${sat - 5}%, 45%)`,
  }
}
