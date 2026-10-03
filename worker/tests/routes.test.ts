import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import worker from '../src/index'
import { sha256, today, type Env } from '../src/env'

// The Worker bundles public/venues.geojson as text (a Text rule in
// wrangler.toml). Vitest cannot load a .geojson on its own, so the import is
// mocked with the real file, and the report route is tested against real ids.
vi.mock('../../public/venues.geojson', async () => {
  const fs = await import('node:fs')
  return { default: fs.readFileSync(new URL('../../public/venues.geojson', import.meta.url), 'utf8') }
})

const VENUES = JSON.parse(readFileSync(new URL('../../public/venues.geojson', import.meta.url), 'utf8')) as {
  features: { properties: { id: string } }[]
}
const PLACE = VENUES.features[0].properties.id

type Row = Record<string, unknown>

// A D1 stand-in fed from canned data: counters are a Map, reports a Set keyed
// like the unique index, and the two aggregate SELECTs return fixed rows.
function fakeEnv(vars: Partial<Env> = {}, rows: { buckets?: Row[]; devices?: Row[] } = {}) {
  const counters = new Map<string, number>()
  const reports = new Set<string>()
  const binds: { sql: string; args: unknown[] }[] = []
  const DB = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          binds.push({ sql, args })
          return {
            async first() {
              if (sql.startsWith('INSERT INTO counters')) {
                const k = String(args[0])
                const n = (counters.get(k) ?? 0) + 1
                counters.set(k, n)
                return { n }
              }
              return null
            },
            async run() {
              if (sql.startsWith('INSERT OR IGNORE INTO reports')) {
                const key = `${args[5]}|${args[0]}|${args[6]}`
                const dup = reports.has(key)
                reports.add(key)
                return { meta: { changes: dup ? 0 : 1 } }
              }
              return { meta: { changes: 1 } }
            },
            async all() {
              if (sql.includes('COUNT(DISTINCT device_hash)')) return { results: rows.devices ?? [] }
              if (sql.includes('AS bucket')) return { results: rows.buckets ?? [] }
              return { results: [] }
            },
          }
        },
      }
    },
  }
  const env = {
    ANTHROPIC_API_KEY: '',
    MODEL: '',
    DAILY_TURN_CAP: '40',
    DAILY_IP_CAP: '400',
    ALLOWED_ORIGIN: '',
    DB,
    ...vars,
  } as unknown as Env
  return { env, counters, binds }
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://api.test' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
const get = (path: string, headers: Record<string, string> = {}) => new Request('https://api.test' + path, { headers })

const turnBody = { device: 'dev-1', scene_id: 'pharmacy-refill', level: 'A2', learning: 'en', history: [], user: 'Hello, I need to pick up medicine.' }

describe('routes', () => {
  it('answers the health check', async () => {
    const { env } = fakeEnv()
    const res = await worker.fetch(get('/api/health'), env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('refuses a turn without a device id', async () => {
    const { env, counters } = fakeEnv()
    const res = await worker.fetch(post('/api/turn', { ...turnBody, device: undefined }), env)
    expect(res.status).toBe(400)
    expect(counters.size).toBe(0)
  })

  it('refuses an unknown scene before any counter is spent', async () => {
    const { env, counters } = fakeEnv()
    const res = await worker.fetch(post('/api/turn', { ...turnBody, scene_id: 'casino' }), env)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'unknown scene' })
    expect(counters.size).toBe(0)
  })

  it('refuses an empty turn with no command, but takes a command alone', async () => {
    const { env, counters } = fakeEnv()
    expect((await worker.fetch(post('/api/turn', { ...turnBody, user: '   ' }), env)).status).toBe(400)
    expect(counters.size).toBe(0)
    // No key and no AI binding: validated, counted, then 503 for the scripted scene.
    const res = await worker.fetch(post('/api/turn', { ...turnBody, user: '', command: 'simpler' }), env)
    expect(res.status).toBe(503)
    expect(counters.size).toBe(2)
  })

  it('answers 429 once the device cap is reached, and keys the IP counter on a hash', async () => {
    const { env, counters } = fakeEnv({ DAILY_TURN_CAP: '1' })
    expect((await worker.fetch(post('/api/turn', turnBody), env)).status).toBe(503)
    const res = await worker.fetch(post('/api/turn', turnBody), env)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'daily cap reached' })
    const keys = [...counters.keys()]
    expect(keys).toContain('dev:' + (await sha256('dev-1')))
    expect(keys).toContain('ip:' + (await sha256(today() + ':203.0.113.9')))
    expect(keys.some((k) => k.includes('203.0.113.9'))).toBe(false)
  })

  it('answers 429 once the IP cap is reached', async () => {
    const { env } = fakeEnv({ DAILY_IP_CAP: '1' })
    expect((await worker.fetch(post('/api/turn', turnBody), env)).status).toBe(503)
    const res = await worker.fetch(post('/api/turn', turnBody), env)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'slow down' })
  })

  it('answers 413 for a body over budget, whatever content-length says', async () => {
    const { env } = fakeEnv()
    const big = JSON.stringify({ ...turnBody, user: 'x'.repeat(40_000) })
    const res = await worker.fetch(post('/api/turn', big), env)
    expect(res.status).toBe(413)
  })

  it('refuses a report for a place the map does not show', async () => {
    const { env, counters } = fakeEnv()
    const res = await worker.fetch(post('/api/report', { device: 'dev-1', place_id: 'nowhere', lang: 'es', positive: true }), env)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'unknown place' })
    expect(counters.size).toBe(0)
  })

  it('inserts a report with a place-salted hash, flags the duplicate, and caps an IP per place', async () => {
    const { env, binds } = fakeEnv()
    const body = { device: 'dev-1', place_id: PLACE, lang: 'es', positive: true, role: 'pharmacist', shift: 'evening' }
    const first = await worker.fetch(post('/api/report', body), env)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ ok: true, duplicate: false })
    const insert = binds.find((b) => b.sql.startsWith('INSERT OR IGNORE INTO reports'))!
    expect(insert.args[0]).toBe(PLACE)
    expect(insert.args[3]).toBe('pharmacist')
    expect(insert.args[5]).toBe(await sha256('dev-1:' + PLACE))
    expect(insert.args[6]).toBe(today())

    const again = await worker.fetch(post('/api/report', body), env)
    expect(await again.json()).toEqual({ ok: true, duplicate: true })

    // A third device from the same IP, same place, same day: over the per-place allowance.
    const third = await worker.fetch(post('/api/report', { ...body, device: 'dev-3' }), env)
    expect(third.status).toBe(429)
  })

  it('aggregates places into the shape the map reads', async () => {
    const { env } = fakeEnv(
      {},
      {
        buckets: [
          { place_id: PLACE, lang: 'es', positive: 1, bucket: 0, n: 3 },
          { place_id: PLACE, lang: 'es', positive: 0, bucket: 2, n: 1 },
        ],
        devices: [{ place_id: PLACE, lang: 'es', devices: 2 }],
      },
    )
    const res = await worker.fetch(get('/api/places'), env)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
    expect(await res.json()).toEqual({
      [PLACE]: {
        es: {
          devices: 2,
          buckets: [
            { b: 0, positive: true, n: 3 },
            { b: 2, positive: false, n: 1 },
          ],
        },
      },
    })
  })

  it('answers 503 for speech when the AI binding is missing', async () => {
    const { env } = fakeEnv()
    const res = await worker.fetch(post('/api/stt?lang=es', 'audio', { 'x-charla-device': 'dev-1', 'content-type': 'audio/wav' }), env)
    expect(res.status).toBe(503)
  })

  it('answers 413 for an oversized clip, and keeps speech on its own counters', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'hola' })
    const { env, counters } = fakeEnv({ AI: { run } as unknown as Ai })
    const headers = { 'x-charla-device': 'dev-1', 'content-type': 'audio/wav' }
    const declared = await worker.fetch(post('/api/stt', 'x', { ...headers, 'content-length': '2000000' }), env)
    expect(declared.status).toBe(413)
    const big = new Uint8Array(1_500_001)
    const streamed = await worker.fetch(
      new Request('https://api.test/api/stt', { method: 'POST', headers, body: big }),
      env,
    )
    expect(streamed.status).toBe(413)
    expect(run).not.toHaveBeenCalled()

    const ok = await worker.fetch(post('/api/stt?lang=es', 'RIFF....', headers), env)
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ text: 'hola' })
    const keys = [...counters.keys()]
    expect(keys.some((k) => k.startsWith('stt:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('ipstt:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('dev:') || k.startsWith('ip:'))).toBe(false)
  })

  it('sends no allow-origin header when ALLOWED_ORIGIN is empty', async () => {
    const { env } = fakeEnv()
    const res = await worker.fetch(get('/api/health'), env)
    expect(res.headers.has('access-control-allow-origin')).toBe(false)
  })

  it('answers 403 to a POST from a foreign origin, before any counter', async () => {
    const { env, counters } = fakeEnv({ ALLOWED_ORIGIN: 'https://charla.test' })
    const res = await worker.fetch(post('/api/turn', turnBody, { origin: 'https://evil.test' }), env)
    expect(res.status).toBe(403)
    expect(counters.size).toBe(0)
    const own = await worker.fetch(post('/api/turn', { ...turnBody, device: undefined }, { origin: 'https://charla.test' }), env)
    expect(own.status).toBe(400)
    expect(own.headers.get('access-control-allow-origin')).toBe('https://charla.test')
    // Unset means closed to browsers: any Origin at all is foreign.
    const closed = fakeEnv()
    expect((await worker.fetch(post('/api/turn', turnBody, { origin: 'https://charla.test' }), closed.env)).status).toBe(403)
  })
})
