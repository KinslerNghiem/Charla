import { Map as MapLibreMap, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Status } from './badges'

// MapLibre on OpenFreeMap tiles: no key, no quota, attribution added automatically.
// The data is our own venues.geojson, built from data/venues.csv.

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

export function createMap(container: HTMLElement, center: [number, number], zoom = 11.5): MapLibreMap {
  return new MapLibreMap({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center,
    zoom,
    attributionControl: { compact: true },
  })
}

const COLORS: Record<Status, string> = {
  confirmed: '#38652F',
  listed_by_business: '#24476B',
  listed_public: '#24476B',
  reported: '#8F5800',
  unknown: '#7A7A72',
}

const COLOR_BY_STATUS: ExpressionSpecification = [
  'match',
  ['get', 'status'],
  'confirmed', COLORS.confirmed,
  'listed_by_business', COLORS.listed_by_business,
  'listed_public', COLORS.listed_public,
  'reported', COLORS.reported,
  COLORS.unknown,
]

export function addVenues(map: MapLibreMap, data: FeatureCollection, onSelect: (id: string) => void): void {
  const add = () => {
    if (map.getSource('venues')) return
    map.addSource('venues', { type: 'geojson', data })
    map.addLayer({
      id: 'venues',
      type: 'circle',
      source: 'venues',
      paint: {
        'circle-radius': 8,
        'circle-color': COLOR_BY_STATUS,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#F7F6F1',
      },
    })
    map.on('click', 'venues', (e) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelect(id)
    })
    map.on('mouseenter', 'venues', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'venues', () => {
      map.getCanvas().style.cursor = ''
    })
  }
  if (map.loaded()) add()
  else map.on('load', add)
}

export function updateVenues(map: MapLibreMap, data: FeatureCollection): void {
  const src = map.getSource('venues') as GeoJSONSource | undefined
  src?.setData(data)
}
