import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// scripts/build_venues.py is the gate between the team's spreadsheet and the
// public map. These run the real script on throwaway CSVs, so a loosened check
// fails here before it ships a stray column or a bad row.

const SCRIPT = fileURLToPath(new URL('../scripts/build_venues.py', import.meta.url))

const HEADER =
  'id,name,town,type,scene_id,address,lat,lng,lang_es,lang_en,roles,shifts,status,format,source,verified_on,club_schedule,meet_ok,notes'

function row(over: Partial<Record<string, string>> = {}): string {
  const r: Record<string, string> = {
    id: 'test-library',
    name: 'Test Library',
    town: 'Aurora',
    type: 'library',
    scene_id: 'library-card',
    address: '"1 Main St, Aurora, IL 60506"',
    lat: '41.75',
    lng: '-88.31',
    lang_es: 'yes',
    lang_en: 'yes',
    roles: 'front desk',
    shifts: '',
    status: 'listed_public',
    format: 'in_person',
    source: 'https://example.org',
    verified_on: '2026-09-01',
    club_schedule: '',
    meet_ok: 'yes',
    notes: 'internal only',
    ...over,
  }
  return HEADER.split(',')
    .map((k) => r[k] ?? '')
    .join(',')
}

function build(rows: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'charla-venues-'))
  const src = join(dir, 'venues.csv')
  const out = join(dir, 'venues.geojson')
  writeFileSync(src, [HEADER, ...rows].join('\n') + '\n', 'utf8')
  const res = spawnSync('python', [SCRIPT, src, out], { encoding: 'utf8' })
  const json = res.status === 0 ? JSON.parse(readFileSync(out, 'utf8')) : null
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, json }
}

describe('build_venues.py', () => {
  it('rejects a duplicate id', () => {
    const r = build([row(), row({ name: 'Same id again' })])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/duplicate id test-library/)
  })

  it('rejects an unknown status', () => {
    const r = build([row({ status: 'verified' })])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/bad status/)
  })

  it('rejects an unknown format', () => {
    const r = build([row({ format: 'zoom' })])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/format must be/)
  })

  it('rejects coordinates outside the area (a 0 is a geocoding slip)', () => {
    const r = build([row({ lat: '0', lng: '0' })])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/outside the area/)
  })

  it('requires a source, but never ships it', () => {
    const r = build([row({ source: '' })])
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/source is required/)
  })

  it('skips a row with no coordinates, loudly, and still exits 0', () => {
    const r = build([row(), row({ id: 'no-coords', lat: '', lng: '' })])
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/SKIPPED 1/)
    expect(r.stdout).toMatch(/no-coords/)
    expect(r.json.features.map((f: { id: string }) => f.id)).toEqual(['test-library'])
  })

  it('ships only the public columns and derives the ZIP table', () => {
    const r = build([row(), row({ id: 'second', address: '"2 Main St, Aurora, IL 60506"', lat: '41.77', lng: '-88.33' })])
    expect(r.status).toBe(0)
    const props = r.json.features[0].properties
    expect(props).not.toHaveProperty('notes')
    expect(props).not.toHaveProperty('source')
    expect(props).not.toHaveProperty('verified_on')
    expect(props).not.toHaveProperty('lat')
    expect(props).toMatchObject({ id: 'second', format: 'in_person', status: 'listed_public' })
    expect(r.json.zips).toEqual({ '60506': [-88.32, 41.76] })
  })
})
