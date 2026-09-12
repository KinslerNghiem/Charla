import { describe, expect, it } from 'vitest'
import { buildTableScript, phaseAt, totalSeconds } from '../src/table/script'
import { SCENES } from '../src/content/scenes'

// The Start button prints Math.round(total / 60) and the intro copy says "ten
// minutes" in both languages. This keeps the two from drifting apart again.
describe('table script', () => {
  const phases = buildTableScript(SCENES[0])

  it('runs exactly ten minutes', () => {
    expect(totalSeconds(phases)).toBe(600)
  })

  it('gives each language the same speaking time', () => {
    const talk = phases.filter((p) => p.id !== 'switch' && p.id !== 'wrap')
    const en = talk.filter((p) => p.lang === 'en').reduce((n, p) => n + p.seconds, 0)
    const es = talk.filter((p) => p.lang === 'es').reduce((n, p) => n + p.seconds, 0)
    expect(en).toBe(es)
  })

  it('finds the phase and the remaining seconds', () => {
    expect(phaseAt(phases, 0)).toEqual({ index: 0, remaining: phases[0].seconds })
    expect(phaseAt(phases, phases[0].seconds)).toEqual({ index: 1, remaining: phases[1].seconds })
    expect(phaseAt(phases, 599)?.index).toBe(phases.length - 1)
    expect(phaseAt(phases, 600)).toBeNull()
  })

  it('has prompts in both languages for every talking phase', () => {
    for (const p of phases) {
      if (p.id === 'switch') continue
      expect(p.prompts.length).toBeGreaterThan(0)
      for (const q of p.prompts) {
        expect(q.en.trim()).not.toBe('')
        expect(q.es.trim()).not.toBe('')
      }
    }
  })
})
