// Map centers, kept apart from map.ts so pages can import them without pulling
// in MapLibre. The map library itself loads only when the Places tab opens.

export const AURORA_DOWNTOWN: [number, number] = [-88.3175, 41.7575]

// Typed ZIP -> center. Anything else shows "Not mapped yet, here's Aurora".
export const ZIP_CENTERS: Record<string, [number, number]> = {
  '60505': [-88.3, 41.76],
  '60506': [-88.33, 41.77],
  '60540': [-88.15, 41.77],
  '60563': [-88.19, 41.8],
  '60564': [-88.2, 41.71],
  '60565': [-88.12, 41.73],
  '60440': [-88.08, 41.7],
}
