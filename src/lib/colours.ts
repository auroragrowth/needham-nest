/**
 * Deterministic colour for a profile id. Same id → same palette across
 * every page.
 *
 * Uses a fixed palette of 10 highly distinct hues rather than hashing
 * into the full colour wheel — with only 5-6 staff the old hash was
 * landing two people in adjacent hues and they read as "the same colour"
 * across the rota and availability grid.
 */
const PALETTE: ReadonlyArray<{ hue: number; sat: number }> = [
  { hue: 158, sat: 55 }, // forest (matches brand)
  { hue: 35, sat: 85 }, // amber
  { hue: 220, sat: 70 }, // royal blue
  { hue: 330, sat: 70 }, // rose pink
  { hue: 280, sat: 55 }, // violet
  { hue: 5, sat: 75 }, // coral
  { hue: 195, sat: 70 }, // sky teal
  { hue: 75, sat: 60 }, // olive lime
  { hue: 250, sat: 65 }, // indigo
  { hue: 15, sat: 65 }, // terracotta
]

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
  const { hue, sat } = PALETTE[Math.abs(hash) % PALETTE.length]
  return {
    bg: `hsl(${hue}, ${sat}%, 90%)`,
    border: `hsl(${hue}, ${sat}%, 45%)`,
    text: `hsl(${hue}, ${sat}%, 22%)`,
    dot: `hsl(${hue}, ${sat}%, 42%)`,
  }
}
