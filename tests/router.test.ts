import { describe, expect, it } from 'vitest'
import { parseHash } from '../src/router'

describe('hash router', () => {
  it('treats an empty or bare hash as the root', () => {
    for (const h of ['', '#', '#/']) {
      const r = parseHash(h)
      expect(r.path).toBe('/')
      expect([...r.params.keys()]).toEqual([])
    }
  })

  it('splits path and query', () => {
    const r = parseHash('#/places?scene=pharmacy-refill&id=x')
    expect(r.path).toBe('/places')
    expect(r.params.get('scene')).toBe('pharmacy-refill')
    expect(r.params.get('id')).toBe('x')
  })

  it('round-trips what go() would write', () => {
    // go(path, params) writes path + '?' + URLSearchParams; parseHash reads it back.
    const params = { scene: 'pharmacy-refill', id: 'walgreens-aurora-1' }
    const hash = '#/places?' + new URLSearchParams(params).toString()
    const r = parseHash(hash)
    expect(r.path).toBe('/places')
    expect(Object.fromEntries(r.params)).toEqual(params)
  })

  it('keeps & ¿ ? and spaces inside a value, because URLSearchParams encodes them', () => {
    const name = 'Taquería El Sol & ¿Qué Más? (Aurora)'
    const hash = '#/places?' + new URLSearchParams({ name, id: 'x' }).toString()
    expect(hash).not.toContain('¿')
    expect(hash.split('?')).toHaveLength(2)
    const r = parseHash(hash)
    expect(r.params.get('name')).toBe(name)
    expect(r.params.get('id')).toBe('x')
  })

  it('documents the current behaviour: a raw second "?" truncates the query', () => {
    // parseHash splits on every '?' and keeps only the first piece after the
    // path. A hand-typed hash with two question marks loses everything after
    // the second. go() never produces one (URLSearchParams writes %3F), so this
    // is a known limit, not a bug the app can hit on its own.
    const r = parseHash('#/places?scene=a?id=b')
    expect(r.path).toBe('/places')
    expect(r.params.get('scene')).toBe('a')
    expect(r.params.get('id')).toBeNull()
  })
})
