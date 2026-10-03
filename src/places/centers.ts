// Map centers, kept apart from map.ts so pages can import them without pulling
// in MapLibre. The map library itself loads only when the Places tab opens.

export const AURORA_DOWNTOWN: [number, number] = [-88.3175, 41.7575]

// The service area: Naperville, Aurora and the towns between. The map cannot
// pan outside it (so tiles stay local) and a "Near me" fix outside it is
// answered with Aurora instead of an empty map.
export const SERVICE_BOUNDS: [[number, number], [number, number]] = [
  [-88.75, 41.45],
  [-87.75, 42.05],
]

export function inServiceArea([lng, lat]: [number, number]): boolean {
  const [[w, s], [e, n]] = SERVICE_BOUNDS
  return lng >= w && lng <= e && lat >= s && lat <= n
}

// Typed ZIP -> center, the fallback when venues.geojson has no place in that
// ZIP (build_venues.py derives a "zips" table from the venues themselves).
export const ZIP_CENTERS: Record<string, [number, number]> = {
  '60504': [-88.26, 41.75],
  '60505': [-88.3, 41.76],
  '60506': [-88.33, 41.77],
  '60517': [-88.05, 41.75],
  '60540': [-88.15, 41.77],
  '60563': [-88.19, 41.8],
  '60564': [-88.2, 41.71],
  '60565': [-88.12, 41.73],
  '60440': [-88.08, 41.7],
}
