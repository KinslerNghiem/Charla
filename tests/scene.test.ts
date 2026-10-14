import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCENES, kidScenes } from '../src/content/scenes'
import { PLACE_TYPES, choicesFor, isLearnerLine, validateScene } from '../src/content/scene.schema'
import { matchesObjective } from '../src/tutor/flow'

const SCENES_DIR = join(__dirname, '..', 'src', 'content', 'scenes')

/** Lowercase, no punctuation, single spaces: good enough to find a phrase inside a line. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:!?¿¡…"“”'’()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('scene cards', () => {
  it('every scene is valid in both languages', () => {
    for (const s of SCENES) {
      expect(validateScene(s), s.id).toEqual([])
    }
  })

  it('ids are unique', () => {
    const ids = SCENES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every JSON file in the scenes folder is registered, and nothing else is', () => {
    const files = readdirSync(SCENES_DIR).filter((f) => f.endsWith('.json')).sort()
    const registered = SCENES.map((s) => `${s.id}.json`).sort()
    expect(files).toEqual(registered)
  })

  it('every scene has a channel, an expect line and a known place type', () => {
    for (const s of SCENES) {
      expect(['counter', 'phone'], `${s.id} channel`).toContain(s.channel)
      expect(s.expect?.en, `${s.id} expect.en`).toBeTruthy()
      expect(s.expect?.es, `${s.id} expect.es`).toBeTruthy()
      expect(PLACE_TYPES, `${s.id} place_type`).toContain(s.place_type)
    }
  })

  it('ships two or three must_use lines the learner can say', () => {
    for (const s of SCENES) {
      expect(s.must_use.length, s.id).toBeGreaterThanOrEqual(2)
      expect(s.must_use.length, s.id).toBeLessThanOrEqual(3)
      for (const p of s.must_use) expect(isLearnerLine(p), `${s.id}: "${p.en}"`).toBe(true)
    }
  })

  it('every must_use phrase is modeled by a best choice in both languages', () => {
    for (const s of SCENES) {
      const best = Object.values(s.offline_script.nodes).flatMap((n) => n.choices.filter((c) => c.best))
      const en = best.map((c) => norm(c.text.en))
      const es = best.map((c) => norm(c.text.es))
      for (const p of s.must_use) {
        expect(en.some((t) => t.includes(norm(p.en))), `${s.id}: "${p.en}" (en)`).toBe(true)
        expect(es.some((t) => t.includes(norm(p.es))), `${s.id}: "${p.es}" (es)`).toBe(true)
      }
    }
  })

  it('gives each direction its own wrong answers, and never two choices that read the same', () => {
    for (const s of SCENES) {
      for (const [id, n] of Object.entries(s.offline_script.nodes)) {
        for (const dir of ['en', 'es'] as const) {
          const shown = choicesFor(n, dir)
          expect(shown.length, `${s.id}:${id} practicing ${dir}`).toBeGreaterThanOrEqual(2)
          expect(shown.some((c) => c.best), `${s.id}:${id} practicing ${dir}`).toBe(true)
          const texts = shown.map((c) => norm(c.text[dir]))
          expect(new Set(texts).size, `${s.id}:${id} practicing ${dir}: two choices read the same`).toBe(texts.length)
        }
        // A wrong answer teaches one language's mistake, so it belongs to one direction.
        for (const c of n.choices) {
          if (!c.best) expect(c.for, `${s.id}:${id} "${c.text.en}" has no direction`).toMatch(/^(en|es)$/)
        }
      }
    }
  })

  it('validator rejects a choice with an unknown direction and a node one direction cannot play', () => {
    const base = JSON.parse(JSON.stringify(SCENES[0]))
    const start = base.offline_script.nodes[base.offline_script.start]
    start.choices[0].for = 'fr'
    expect(validateScene(base).some((e) => e.includes('"for"'))).toBe(true)
    const lonely = JSON.parse(JSON.stringify(SCENES[0]))
    const node = lonely.offline_script.nodes[lonely.offline_script.start]
    for (const c of node.choices) if (!c.best) c.for = 'en'
    expect(validateScene(lonely).some((e) => e.includes('practicing es sees fewer'))).toBe(true)
  })

  it('every must-use line has key words in both languages that match itself and no other line of its scene', () => {
    for (const s of SCENES) {
      s.must_use.forEach((p, i) => {
        for (const lang of ['en', 'es'] as const) {
          expect(p.keys?.[lang]?.length ?? 0, `${s.id} "${p.en}" keys.${lang}`).toBeGreaterThan(0)
          expect(matchesObjective(p[lang], p, lang), `${s.id}: "${p[lang]}" should match its own keys`).toBe(true)
          s.must_use.forEach((q, j) => {
            if (j !== i) expect(matchesObjective(q[lang], p, lang), `${s.id}: "${q[lang]}" also matches the keys of "${p[lang]}"`).toBe(false)
          })
        }
      })
    }
  })

  it('show_staff_line is written for a reader of that language', () => {
    // The learner shows the TARGET-language side to the staff, so the es side
    // is read by an English speaker learning Spanish, and vice versa.
    for (const s of SCENES) {
      expect(s.show_staff_line.en, s.id).toMatch(/English/)
      expect(s.show_staff_line.es, s.id).toMatch(/español/)
    }
  })

  it('every offline script can be walked to the end by choosing best answers', () => {
    for (const s of SCENES) {
      let node = s.offline_script.start
      let steps = 0
      while (node) {
        const n = s.offline_script.nodes[node]
        const best = n.choices.find((c) => c.best)
        expect(best, `${s.id}:${node}`).toBeDefined()
        node = best!.next ?? ''
        steps++
        expect(steps, `${s.id} loops`).toBeLessThan(50)
      }
      expect(steps).toBeGreaterThanOrEqual(3)
    }
  })

  it('has at least two kid scenes with pictures on every choice', () => {
    const kids = kidScenes()
    expect(kids.length).toBeGreaterThanOrEqual(2)
    for (const s of SCENES) {
      for (const n of Object.values(s.offline_script.nodes)) {
        for (const c of n.choices) expect(c.picture, `${s.id}: ${c.text.en}`).toBeTruthy()
      }
    }
  })

  it('validator rejects a scene missing a Spanish side', () => {
    const broken = JSON.parse(JSON.stringify(SCENES[0]))
    broken.goal = { en: 'only english' }
    expect(validateScene(broken)).not.toEqual([])
  })

  it('validator rejects a bare-word must_use, an unknown place type and a fourth phrase', () => {
    const base = JSON.parse(JSON.stringify(SCENES[0]))
    const bare = { ...base, must_use: [base.must_use[0], { en: 'prescription', es: 'receta' }] }
    expect(validateScene(bare).some((e) => e.includes('learner can say'))).toBe(true)
    const place = { ...base, place_type: 'spaceport' }
    expect(validateScene(place).some((e) => e.includes('place_type'))).toBe(true)
    const four = { ...base, must_use: [...base.must_use, { en: 'One more line here.', es: 'Una línea más aquí.' }] }
    expect(validateScene(four).some((e) => e.includes('2 or 3'))).toBe(true)
  })
})
