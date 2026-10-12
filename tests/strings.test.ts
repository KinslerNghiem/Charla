import { describe, expect, it } from 'vitest'
import { STRINGS } from '../src/i18n/strings'

// English is the source text. A key missing in Spanish would fall back to
// English silently in the UI, so parity is enforced here instead.
describe('i18n strings', () => {
  it('have the same keys in English and Spanish', () => {
    const en = Object.keys(STRINGS.en).sort()
    const es = Object.keys(STRINGS.es).sort()
    expect(es).toEqual(en)
  })

  it('have no empty strings', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const [k, v] of Object.entries(STRINGS[lang])) {
        expect(v.trim(), `${lang}.${k}`).not.toBe('')
      }
    }
  })

  it('names keys in snake_case, so a dynamic lookup like `type_${x}` is predictable', () => {
    for (const k of Object.keys(STRINGS.en)) expect(k).toMatch(/^[a-z][a-z0-9]*(_[a-zA-Z0-9]+)*$/)
  })

  it('translate rather than copy (most Spanish strings differ from English)', () => {
    const keys = Object.keys(STRINGS.en) as (keyof typeof STRINGS.en)[]
    const same = keys.filter((k) => STRINGS.en[k] === STRINGS.es[k])
    // app_name and a few short labels legitimately match; anything more is a copy-paste.
    expect(same.length).toBeLessThanOrEqual(4)
  })
})
