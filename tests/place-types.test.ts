import { describe, expect, it } from 'vitest'
import { PLACE_ICON } from '../src/content/icons'
import { PLACE_TYPES } from '../src/content/scene.schema'
import { SCENES } from '../src/content/scenes'
import { THEMES, themeOf } from '../src/content/themes'
import { STRINGS } from '../src/i18n/strings'

// A place type is three things at once: a label in both languages, an icon,
// and a heading in the picker. Adding one without the others would show a
// raw key or an empty group, so this ties them together.
describe('place types', () => {
  it('every place type has a label in both languages and an icon', () => {
    for (const ty of PLACE_TYPES) {
      const key = `type_${ty}` as keyof typeof STRINGS.en
      expect(STRINGS.en[key], `en ${key}`).toBeTruthy()
      expect(STRINGS.es[key], `es ${key}`).toBeTruthy()
      expect(PLACE_ICON[ty], `icon ${ty}`).toBeTruthy()
    }
  })

  it('every theme has a heading in both languages and every scene lands in one', () => {
    for (const th of THEMES) {
      const key = `group_${th}` as keyof typeof STRINGS.en
      expect(STRINGS.en[key], `en ${key}`).toBeTruthy()
      expect(STRINGS.es[key], `es ${key}`).toBeTruthy()
    }
    for (const s of SCENES) expect(THEMES, s.id).toContain(themeOf(s))
  })

  it('no place type is left without a scene', () => {
    const used = new Set(SCENES.map((s) => s.place_type))
    for (const ty of PLACE_TYPES) expect(used.has(ty), `no scene uses ${ty}`).toBe(true)
  })
})
