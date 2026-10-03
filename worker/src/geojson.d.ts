// public/venues.geojson is bundled into the Worker as a string by the Text rule
// in wrangler.toml, so /api/report can check a place id against the shipped
// map without a second copy of the list. Tests mock this import (vitest cannot
// load a .geojson file on its own) with the real file read from disk.
declare module '*.geojson' {
  const text: string
  export default text
}
