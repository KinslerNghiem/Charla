import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { venueField } from '../src/places/venueText'

// The map's free text reaches the learner in the interface language. The unit
// checks the pick; the data check makes sure the sheet keeps both columns
// filled, so a Spanish reader never meets "conversation group tutor".

describe('venueField', () => {
  const p = { roles: 'front desk', roles_es: 'recepción', shifts: 'Saturdays 10-12', shifts_es: '', club_schedule: '' }

  it('reads the Spanish column for a Spanish interface', () => {
    expect(venueField(p, 'roles', 'es')).toBe('recepción')
    expect(venueField(p, 'roles', 'en')).toBe('front desk')
  })

  it('falls back to English only when the sheet has no Spanish yet', () => {
    expect(venueField(p, 'shifts', 'es')).toBe('Saturdays 10-12')
    expect(venueField(p, 'club_schedule', 'es')).toBe('')
    expect(venueField({}, 'roles', 'es')).toBe('')
  })
})

describe('venues.geojson carries Spanish beside every English cell', () => {
  const FILE = fileURLToPath(new URL('../public/venues.geojson', import.meta.url))
  const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { features: [] }

  it('has a Spanish value wherever it has an English one, and the reverse', () => {
    expect(data.features.length).toBeGreaterThan(0)
    for (const f of data.features) {
      for (const col of ['roles', 'shifts', 'club_schedule'] as const) {
        const en = (f.properties[col] ?? '').trim()
        const es = (f.properties[`${col}_es`] ?? '').trim()
        expect(Boolean(es), `${f.id}.${col}: "${en}" has no Spanish`).toBe(Boolean(en))
      }
    }
  })
})
