/**
 * Per-profile colours: 10 visually distinct hues.
 *
 * Each profile gets an entry from PALETTE. Owners + staff get a fixed
 * colour from profiles.colour_index when one is set; otherwise the id is
 * hashed into the palette as a fallback so new staff still get a stable
 * colour out of the box.
 */
const PALETTE: ReadonlyArray<{ hue: number; sat: number; name: string }> = [
  { hue: 158, sat: 55, name: 'Forest' },
  { hue: 35, sat: 85, name: 'Amber' },
  { hue: 220, sat: 70, name: 'Royal blue' },
  { hue: 330, sat: 70, name: 'Rose' },
  { hue: 280, sat: 55, name: 'Violet' },
  { hue: 5, sat: 75, name: 'Coral' },
  { hue: 195, sat: 70, name: 'Sky teal' },
  { hue: 75, sat: 60, name: 'Olive' },
  { hue: 250, sat: 65, name: 'Indigo' },
  { hue: 15, sat: 65, name: 'Terracotta' },
]

export const COLOUR_OPTIONS = PALETTE.map((p, i) => ({
  index: i,
  name: p.name,
  hue: p.hue,
  sat: p.sat,
}))

type Shades = {
  bg: string
  border: string
  text: string
  dot: string
}

function shadesFor(hue: number, sat: number): Shades {
  return {
    bg: `hsl(${hue}, ${sat}%, 90%)`,
    border: `hsl(${hue}, ${sat}%, 45%)`,
    text: `hsl(${hue}, ${sat}%, 22%)`,
    dot: `hsl(${hue}, ${sat}%, 42%)`,
  }
}

export function colourForIndex(i: number): Shades {
  const safe = ((i % PALETTE.length) + PALETTE.length) % PALETTE.length
  const { hue, sat } = PALETTE[safe]
  return shadesFor(hue, sat)
}

export function colourForProfile(
  id: string,
  colourIndex?: number | null,
): Shades {
  if (
    colourIndex != null &&
    colourIndex >= 0 &&
    colourIndex < PALETTE.length
  ) {
    return colourForIndex(colourIndex)
  }
  let hash = 5381
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) + hash + id.charCodeAt(i)
  }
  const { hue, sat } = PALETTE[Math.abs(hash) % PALETTE.length]
  return shadesFor(hue, sat)
}
