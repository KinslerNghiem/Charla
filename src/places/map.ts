import { Map as MapLibreMap, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 ships its worker as a separate module and finds it next to its
// own import.meta.url, which a bundler never emits. `?worker&url` makes Vite
// bundle the worker (with its shared chunk) and hand back the hashed path.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Status } from './badges'
import { SERVICE_BOUNDS } from './centers'

// MapLibre on OpenFreeMap tiles: no key, no quota, attribution added automatically.
// The data is our own venues.geojson, built from data/venues.csv.
//
// This module is loaded with a dynamic import() from the Places page, so the
// megabyte of MapLibre arrives only when someone opens the map. Centers live in
// centers.ts so the page can use them before this module has loaded.

setWorkerUrl(workerUrl)

export function createMap(container: HTMLElement, center: [number, number], zoom = 11.5): MapLibreMap {
  return new MapLibreMap({
    container,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center,
    zoom,
    // Tiles stay inside the service area: nothing to pan to, nothing to fetch.
    minZoom: 9,
    maxZoom: 16,
    maxBounds: SERVICE_BOUNDS,
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

// Each feature carries a boolean `selected` property set by the page.
const IS_SELECTED: ExpressionSpecification = ['boolean', ['get', 'selected'], false]

/**
 * Adds the venue source and layer once the style has loaded. `getData` is
 * read at that moment, not at call time, so a filter change or a report that
 * resolved while the style was still downloading is not lost.
 */
export function addVenues(map: MapLibreMap, getData: () => FeatureCollection, onSelect: (id: string) => void): void {
  const add = () => {
    if (map.getSource('venues')) return
    map.addSource('venues', { type: 'geojson', data: getData() })
    map.addLayer({
      id: 'venues',
      type: 'circle',
      source: 'venues',
      layout: {
        // The selected pin draws on top of its neighbours.
        'circle-sort-key': ['case', IS_SELECTED, 1, 0],
      },
      paint: {
        'circle-radius': ['case', IS_SELECTED, 10, 8],
        'circle-color': COLOR_BY_STATUS,
        'circle-stroke-width': ['case', IS_SELECTED, 4, 2],
        'circle-stroke-color': ['case', IS_SELECTED, '#1F1E1A', '#F7F6F1'],
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
