import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addStreak, clearAll, deviceId, get, set, streakThisWeek } from '../src/storage'

// A Map-backed stand-in for window.localStorage. Node has no DOM storage, and
// the real thing is a quirky object: Object.keys() lists the stored keys, which
// clearAll() relies on, so the Proxy below exposes the Map's keys as own
// enumerable properties the way a browser does.
function fakeStorage(opts: { throwOnSet?: boolean } = {}) {
  const store = new Map<string, string>()
  const api = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new Error('QuotaExceededError')
      store.set(k, String(v))
    },
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  return new Proxy(api as unknown as Storage, {
    get: (target, prop) => (prop in target ? (target as unknown as Record<PropertyKey, unknown>)[prop] : store.get(String(prop))),
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (_t, prop) =>
      store.has(String(prop)) ? { value: store.get(String(prop)), enumerable: true, configurable: true, writable: true } : undefined,
  })
}

function install(storage: Storage) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
}

describe('storage', () => {
  beforeEach(() => install(fakeStorage()))
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage
  })

  it('round-trips JSON under the charla. prefix', () => {
    set('thing', { a: 1 })
    expect(localStorage.getItem('charla.thing')).toBe('{"a":1}')
    expect(get('thing', null)).toEqual({ a: 1 })
    expect(get('missing', 'fallback')).toBe('fallback')
  })

  it('falls back when the stored value is corrupt JSON', () => {
    localStorage.setItem('charla.broken', '{not json')
    expect(get('broken', 'fallback')).toBe('fallback')
  })

  it('does not throw when setItem throws (private mode, full disk)', () => {
    install(fakeStorage({ throwOnSet: true }))
    expect(() => set('x', 1)).not.toThrow()
    expect(get('x', 'none')).toBe('none')
    expect(() => addStreak({ ts: 1, place_id: 'p', how: 'easy' })).not.toThrow()
  })

  it('clearAll removes only our keys', () => {
    localStorage.setItem('other.key', 'keep me')
    set('a', 1)
    set('b', 2)
    clearAll()
    expect(localStorage.getItem('charla.a')).toBeNull()
    expect(localStorage.getItem('charla.b')).toBeNull()
    expect(localStorage.getItem('other.key')).toBe('keep me')
  })

  it('mints one device id and keeps it', () => {
    const first = deviceId()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(deviceId()).toBe(first)
    expect(get('device', '')).toBe(first)
  })

  it('counts streak entries inside the last seven days, boundary excluded', () => {
    const now = 1_700_000_000_000
    const week = 7 * 86400000
    addStreak({ ts: now - 1, place_id: 'a', how: 'easy' })
    addStreak({ ts: now - week + 1, place_id: 'b', how: 'okay' }) // just inside
    addStreak({ ts: now - week, place_id: 'c', how: 'hard' }) // exactly 7 days: out
    addStreak({ ts: now - week - 1, place_id: 'd', how: 'easy' }) // out
    expect(streakThisWeek(now)).toBe(2)
    expect(addStreak({ ts: now, place_id: 'e', how: 'easy' })).toHaveLength(5)
    expect(streakThisWeek(now)).toBe(3)
  })
})
