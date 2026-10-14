import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SKILLS, SKILL_IDS, isSkillId, skillById, skillsForScene } from '../src/skills/skills'
import { detectIn, HELP_SKILLS } from '../src/skills/intents'
import { markTried, recordUse, resetSkills, setAgain, skillsStore, statusOf } from '../src/skills/progress'
import { sceneById } from '../src/content/scenes'

// The skill definitions are data; this checks the data holds together: every
// id is known, every related scene exists, every line the app will show as
// "say it like this" is recognized by the classifier as that skill, and the
// drill's cues do not accidentally contain the skill themselves.

describe('skill definitions', () => {
  it('cover the eight ids once each', () => {
    expect(SKILLS.map((s) => s.id)).toEqual([...SKILL_IDS])
    expect(new Set(SKILL_IDS).size).toBe(8)
    expect(isSkillId('repeat')).toBe(true)
    expect(isSkillId('banana')).toBe(false)
    expect(skillById('confirm')?.id).toBe('confirm')
    expect(skillById(null)).toBeUndefined()
  })

  it('are complete in both languages and point at real scenes', () => {
    const bi = (v: { en: string; es: string }, where: string) => {
      expect(v.en.trim(), where).not.toBe('')
      expect(v.es.trim(), where).not.toBe('')
      expect(v.en, where).not.toBe(v.es)
    }
    for (const s of SKILLS) {
      bi(s.name, `${s.id}.name`)
      bi(s.what, `${s.id}.what`)
      bi(s.done, `${s.id}.done`)
      bi(s.example.partner, `${s.id}.example.partner`)
      bi(s.example.learner, `${s.id}.example.learner`)
      expect(s.phrases.length, `${s.id}.phrases`).toBeGreaterThanOrEqual(2)
      expect(s.phrases.length, `${s.id}.phrases`).toBeLessThanOrEqual(3)
      s.phrases.forEach((p, i) => bi(p, `${s.id}.phrases[${i}]`))
      expect(s.drills.length, `${s.id}.drills`).toBe(2)
      s.drills.forEach((d, i) => {
        bi(d.cue, `${s.id}.drills[${i}].cue`)
        bi(d.hint, `${s.id}.drills[${i}].hint`)
      })
      expect(s.scenes.length, `${s.id}.scenes`).toBeGreaterThanOrEqual(2)
      for (const id of s.scenes) expect(sceneById(id), `${s.id} → scene ${id}`).toBeDefined()
    }
  })

  it('every "say it like this" line and example is recognized as its own skill, in both languages', () => {
    for (const s of SKILLS) {
      for (const lang of ['en', 'es'] as const) {
        const ctx = { prevPartner: s.example.partner[lang] }
        expect(detectIn(s.example.learner[lang], lang, ctx), `${s.id} example (${lang}): ${s.example.learner[lang]}`).toContain(s.id)
        for (const p of s.phrases) expect(detectIn(p[lang], lang, ctx), `${s.id} phrase (${lang}): ${p[lang]}`).toContain(s.id)
      }
    }
  })

  it('a plain request is only ever one of the plain requests', () => {
    for (const s of SKILLS.filter((x) => HELP_SKILLS.includes(x.id))) {
      for (const lang of ['en', 'es'] as const) {
        for (const p of s.phrases) {
          const others = detectIn(p[lang], lang).filter((id) => id !== s.id && HELP_SKILLS.includes(id))
          expect(others, `${s.id} phrase (${lang}) "${p[lang]}" also read as ${others.join(', ')}`).toEqual([])
        }
      }
    }
  })

  it('the drill cues are the partner\'s lines and do not contain the skill', () => {
    for (const s of SKILLS) {
      for (const lang of ['en', 'es'] as const) {
        for (const d of s.drills) expect(detectIn(d.cue[lang], lang), `${s.id} cue (${lang}): ${d.cue[lang]}`).not.toContain(s.id)
      }
    }
  })

  it('a scene knows which skills come up in it', () => {
    expect(skillsForScene('pharmacy-refill').map((s) => s.id)).toEqual(['repeat', 'unknown_word'])
    expect(skillsForScene('no-such-scene')).toEqual([])
  })
})

describe('skills progress on the device', () => {
  const store = new Map<string, string>()
  const fake = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  let had: PropertyDescriptor | undefined
  beforeEach(() => {
    store.clear()
    had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true })
  })
  afterEach(() => {
    if (had) Object.defineProperty(globalThis, 'localStorage', had)
    else delete (globalThis as Record<string, unknown>).localStorage
  })

  it('starts empty and moves from new to tried to used', () => {
    expect(skillsStore()).toEqual({})
    expect(statusOf(skillsStore(), 'repeat')).toBe('new')
    markTried('repeat', 1000)
    expect(statusOf(skillsStore(), 'repeat')).toBe('tried')
    expect(skillsStore().repeat?.tried).toBe(1000)
    recordUse('repeat', 'pharmacy-refill', 2000)
    expect(statusOf(skillsStore(), 'repeat')).toBe('used')
    expect(skillsStore().repeat?.used).toEqual([{ scene_id: 'pharmacy-refill', ts: 2000 }])
    // Using it never loses the drill record, and the other skills are untouched.
    expect(skillsStore().repeat?.tried).toBe(1000)
    expect(statusOf(skillsStore(), 'confirm')).toBe('new')
  })

  it('keeps the "practice again" mark and the last twenty uses', () => {
    setAgain('confirm', true)
    expect(skillsStore().confirm?.again).toBe(true)
    setAgain('confirm', false)
    expect(skillsStore().confirm?.again).toBe(false)
    for (let i = 0; i < 25; i++) recordUse('confirm', 'post-office-package', i)
    expect(skillsStore().confirm?.used.length).toBe(20)
    expect(skillsStore().confirm?.used[0].ts).toBe(5)
  })

  it('lives under the charla. prefix and resets on its own', () => {
    markTried('repeat')
    expect(store.has('charla.skills')).toBe(true)
    store.set('charla.lang', '"es"')
    resetSkills()
    expect(store.has('charla.skills')).toBe(false)
    expect(store.get('charla.lang')).toBe('"es"')
    expect(skillsStore()).toEqual({})
  })

  it('tolerates a corrupt or old value', () => {
    store.set('charla.skills', '"not an object"')
    expect(skillsStore()).toEqual({})
    store.set('charla.skills', JSON.stringify({ repeat: { tried: 5 } }))
    expect(statusOf(skillsStore(), 'repeat')).toBe('tried')
    recordUse('repeat', 'clinic-front-desk', 9)
    expect(skillsStore().repeat?.used).toEqual([{ scene_id: 'clinic-front-desk', ts: 9 }])
  })
})
