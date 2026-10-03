import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STATUSES } from '../src/places/badges'

// Run `npm run venues` (python scripts/build_venues.py) before the tests; CI does.
const FILE = fileURLToPath(new URL('../public/venues.geojson', import.meta.url))

// Two capitalized words in a row is what a person's name looks like. \p{Lu}\p{Ll}
// with the u flag, not [A-Z][a-z], or "María Núñez" slips straight through.
const LOOKS_LIKE_A_NAME = /\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+/u

// Proper nouns that legitimately appear in venue prose. Anything not on this
// list that looks like a name fails, which is the point.
const ALLOWED = [
  'English Conversation',
  'ESL Reading',
  'Literacy DuPage',
  'Santori Library',
  'Naperville Public',
  'Aurora Public',
  'Nichols Library',
  'Cedar Glade',
  'Naper Blvd',
  'River St',
  'Constitution Dr',
  'Indian Trail',
  'Diehl Rd',
  'Lake St',
  'Eola Road',
  'Plaza Dr',
  'Briarcliff Rd',
  'Highland Ave',
  'Weston Ave',
  'Remington Blvd',
  'Rickert Dr',
  'Washington Middle',
  'Naperville North',
  'College of DuPage',
  'English Language Acquisition',
  'Language Acquisition',
  'Fox Valley',
  'Secretary of State',
  'Driver Services',
  'Community College',
  'Health Care',
  'Health Center',
  'Public Library',
  'West Branch',
  'Meeting Room',
  'Board Room',
]

describe('venues.geojson', () => {
  it('exists (run: python scripts/build_venues.py)', () => {
    expect(existsSync(FILE), 'public/venues.geojson is missing').toBe(true)
  })

  const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { features: [] }

  it('is a FeatureCollection of points inside the area with valid statuses', () => {
    expect(data.type).toBe('FeatureCollection')
    expect(data.features.length).toBeGreaterThanOrEqual(10)
    for (const f of data.features) {
      const [lng, lat] = f.geometry.coordinates
      expect(lng, f.id).toBeGreaterThan(-88.6)
      expect(lng, f.id).toBeLessThan(-87.8)
      expect(lat, f.id).toBeGreaterThan(41.4)
      expect(lat, f.id).toBeLessThan(42.1)
      expect(STATUSES, `${f.id} status`).toContain(f.properties.status)
      expect(['in_person', 'online', 'both'], `${f.id} format`).toContain(f.properties.format)
    }
  })

  it('ships only public columns (notes, source and verified_on stay in the CSV)', () => {
    for (const f of data.features) {
      expect(f.properties, f.id).not.toHaveProperty('notes')
      expect(f.properties, f.id).not.toHaveProperty('source')
      expect(f.properties, f.id).not.toHaveProperty('verified_on')
    }
  })

  it('carries a ZIP -> centroid table derived from the venues', () => {
    expect(data.zips).toBeTypeOf('object')
    for (const [zip, [lng, lat]] of Object.entries<[number, number]>(data.zips)) {
      expect(zip).toMatch(/^\d{5}$/)
      expect(lng).toBeGreaterThan(-88.6)
      expect(lng).toBeLessThan(-87.8)
      expect(lat).toBeGreaterThan(41.4)
      expect(lat).toBeLessThan(42.1)
    }
    // Woodridge and the Eola branch ZIPs are typed in centers.ts; the rest come from here.
    expect(Object.keys(data.zips)).toContain('60517')
  })

  it('lists no business without a signed yes and no row still marked for checking', () => {
    for (const f of data.features) {
      // A business row exists only after someone there said yes. Public programs need no signature.
      if (!['library', 'college', 'clinic', 'driver_services', 'community'].includes(f.properties.type)) {
        expect(f.properties.status, `${f.id} is a business without a signed yes`).toBe('listed_by_business')
      }
      for (const col of ['roles', 'shifts', 'club_schedule'] as const) {
        expect(f.properties[col] ?? '', `${f.id}.${col}`).not.toMatch(/verify/i)
      }
    }
  })

  it('never names a staff member, in any free-text column', () => {
    // Every free-text column that reaches the client. `notes` never does.
    for (const f of data.features) {
      for (const col of ['roles', 'shifts', 'club_schedule'] as const) {
        let text: string = f.properties[col] ?? ''
        for (const phrase of ALLOWED) text = text.split(phrase).join('')
        expect(text, `${f.id}.${col} looks like it names a person`).not.toMatch(LOOKS_LIKE_A_NAME)
      }
    }
  })
})
