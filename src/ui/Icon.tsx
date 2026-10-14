// The app's icons: one set, one stroke, drawn here so nothing is fetched and
// every glyph matches in weight. Each icon is a 24-unit grid of path data;
// circles are written as two arcs so a single <path> element type covers
// everything. Kid mode keeps its emoji pictures (they are the scenes'
// content, not chrome) and never uses this file for them.

import type { PlaceType } from '../content/scene.schema'

const c = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`

const PLACE: Record<PlaceType, string[]> = {
  pharmacy: ['M4 4h16v16H4z', 'M12 8v8M8 12h8'],
  restaurant: ['M3 15a9 9 0 0 1 18 0H3z', 'M7.5 15c1-3 2.5-4.5 4.5-4.5s3.5 1.5 4.5 4.5'],
  clinic: ['M3 12h4l2-5 3 10 2-5h7'],
  driver_services: ['M3 5h18v14H3z', c(8.5, 11, 2), 'M5.5 16c.5-1.5 1.5-2 3-2s2.5.5 3 2M14 10h4M14 13.5h4'],
  school: ['M4 20V9l8-5 8 5v11', 'M4 20h16M10 20v-5h4v5', 'M12 4V2h3'],
  grocery: ['M3 4h2l2.5 11h10l2-7H6.5', c(9, 19, 1.4), c(16, 19, 1.4)],
  library: ['M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z', 'M4 19a2 2 0 0 1 2-2h12'],
  ice_cream: ['M8 10h8l-4 11z', 'M7 10a5 5 0 0 1 10 0'],
  home: ['M4 11l8-7 8 7', 'M6 10v10h12V10', 'M10 20v-6h4v6'],
  work: ['M3 7h18v13H3z', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18'],
  college: ['M2 9l10-4 10 4-10 4z', 'M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5', 'M22 9v6'],
  bank: ['M3 9l9-5 9 5', 'M4 9h16M5 9v8M10 9v8M14 9v8M19 9v8M3 20h18'],
  post_office: ['M3 5h18v14H3z', 'M3 7l9 6 9-6'],
  transit: ['M4 3h16v15H4z', 'M4 11h16M8 18v2M16 18v2', c(8, 15, 1), c(16, 15, 1)],
  park: ['M12 3l5 7h-3l4 5H6l4-5H7z', 'M12 15v6'],
}

const MISC = {
  rehearse: ['M4 5h16v10H9l-5 4z'],
  skills: ['M4 5h16v10H9l-5 4z', 'M9 10l2 2 4-4'],
  card: ['M3 5h18v14H3z', 'M3 9h18', 'M7 13h6'],
  places: ['M12 21s6-5.5 6-11a6 6 0 0 0-12 0c0 5.5 6 11 6 11z', c(12, 10, 2)],
  table: ['M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z', 'M16 10h2a2 2 0 0 1 0 4h-2M5 21h12'],
  kids: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  speaker: ['M4 9v6h4l5 4V5L8 9z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  stop: ['M6 6h12v12H6z'],
  mic: ['M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3M9 21h6'],
  globe: [c(12, 12, 9), 'M3 12h18', 'M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  check: ['M5 12l5 5 9-10'],
  back: ['M15 5l-7 7 7 7'],
  send: ['M4 12L20 4l-4 16-4-7z'],
  info: [c(12, 12, 9), 'M12 11v6M12 7.5v.5'],
  lock: ['M6 11h12v10H6z', 'M9 11V7a3 3 0 0 1 6 0v4'],
  clock: [c(12, 12, 9), 'M12 7v5l3 2'],
  swap: ['M4 8h14l-3-3M20 16H6l3 3'],
  sticker: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
}

export type IconName = PlaceType | keyof typeof MISC

const ALL: Record<string, string[]> = { ...PLACE, ...MISC }
/** Glyphs drawn as a solid shape rather than a stroke. */
const FILLED = new Set<string>(['stop'])

/** One line icon. Decorative by default; pass a `label` to make it the control's name. */
export function Icon({ name, size = 24, label, class: cls }: { name: IconName; size?: number; label?: string; class?: string }) {
  const paths = ALL[name] ?? MISC.info
  return (
    <svg
      class={'ico' + (cls ? ' ' + cls : '')}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={FILLED.has(name) ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {paths.map((d) => (
        <path d={d} />
      ))}
    </svg>
  )
}

/** The mark: a laminated card, tilted, with its language band. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg class="mark" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="2.5" y="4.5" width="19" height="14" rx="2.5" fill="var(--card)" stroke="var(--ink)" stroke-width="1.5" transform="rotate(-8 12 12)" />
      <path d="M3.25 9.5h17.5" stroke="var(--accent)" stroke-width="3" transform="rotate(-8 12 12)" />
      <path d="M7 13.5h7" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round" transform="rotate(-8 12 12)" />
    </svg>
  )
}
