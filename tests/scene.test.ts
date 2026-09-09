import { describe, expect, it } from 'vitest'
import { SCENES, kidScenes } from '../src/content/scenes'
import { validateScene } from '../src/content/scene.schema'

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
    for (const s of kids) {
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
})
