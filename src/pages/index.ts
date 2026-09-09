// The networked half of the app, loaded as one chunk only when the birth gate
// says teen or adult. Charlita (src/pages/Ninos.tsx) is imported statically by
// app.tsx and deliberately kept out of this file: in kid mode the browser never
// fetches or evaluates the map, the API client or anything they pull in.
// tests/ninos-offline.test.ts enforces that separation.
export { Learn } from './Learn'
export { Places } from './Places'
export { Card } from './Card'
export { Table } from './Table'
export { Privacy } from './Privacy'
