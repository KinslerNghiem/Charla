import { afterEach, describe, expect, it, vi } from 'vitest'
import { bump, underCap } from '../src/caps'
import { today, yesterday, type Env } from '../src/env'

// A D1 stand-in just deep enough for the counters statement: one upsert that
// returns the new value, and the prune that follows a key's first hit of the day.
function fakeDb(opts: { noRow?: boolean } = {}) {
  const counters = new Map<string, number>()
  const deletes: unknown[][] = []
  const DB = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (opts.noRow) return null
              const k = `${args[0]}|${args[1]}`
              const n = (counters.get(k) ?? 0) + 1
              counters.set(k, n)
              return { n }
            },
            async run() {
              if (sql.startsWith('DELETE FROM counters')) deletes.push(args)
              return { meta: { changes: 0 } }
            },
          }
        },
      }
    },
  }
  return { DB, counters, deletes }
}

const envWith = (DB: unknown, vars: Partial<Env> = {}): Env =>
  ({ ANTHROPIC_API_KEY: '', MODEL: '', DAILY_TURN_CAP: '', DAILY_IP_CAP: '', ALLOWED_ORIGIN: '', DB, ...vars }) as unknown as Env

describe('caps', () => {
  afterEach(() => vi.useRealTimers())

  it('fails closed when the upsert returns no row', async () => {
    const { DB } = fakeDb({ noRow: true })
    expect(await bump(envWith(DB), 'dev:x', 40)).toBe(false)
  })

  it('allows up to and including the cap, then refuses', async () => {
    const { DB } = fakeDb()
    const env = envWith(DB)
    expect(await bump(env, 'k', 2)).toBe(true)
    expect(await bump(env, 'k', 2)).toBe(true)
    expect(await bump(env, 'k', 2)).toBe(false)
  })

  it('defaults the device cap to 40', async () => {
    const { DB } = fakeDb()
    const env = envWith(DB)
    for (let i = 0; i < 40; i++) expect(await underCap(env, 'h')).toBe(true)
    expect(await underCap(env, 'h')).toBe(false)
  })

  it('prunes counters older than yesterday on a key\'s first hit of the day only', async () => {
    const { DB, deletes } = fakeDb()
    const env = envWith(DB)
    await bump(env, 'k', 5)
    await bump(env, 'k', 5)
    expect(deletes).toEqual([[yesterday()]])
  })

  it('draws the day boundary in Chicago, not UTC', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-02T03:30:00Z'))
    expect(today()).toBe('2026-10-01')
    expect(yesterday()).toBe('2026-09-30')
    // The night after the spring DST switch: still one calendar day back.
    vi.setSystemTime(new Date('2026-03-09T06:30:00Z'))
    expect(today()).toBe('2026-03-09')
    expect(yesterday()).toBe('2026-03-08')
    // Across a month boundary.
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'))
    expect(yesterday()).toBe('2026-10-31')
  })
})
