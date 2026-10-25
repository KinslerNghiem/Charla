import { describe, expect, it } from 'vitest'
import { buildSystem, commandText, placeLine } from '../src/prompt'
import { sceneById } from '../../src/content/scenes'

// The partner's instructions, pinned. These do not prove the model obeys (the
// bench in scripts/convo-bench.mjs and a bilingual reader do that); they prove
// the prompt asks for the right things in the right language for each
// direction and level, and that it stays a frozen, caller-free prefix.

const pharmacy = sceneById('pharmacy-refill')!

describe('the partner prompt', () => {
  it('names the right languages for each direction', () => {
    const toEn = buildSystem(pharmacy, 'A2', 'en')
    expect(toEn).toMatch(/"reply" is always in English/)
    expect(toEn).toMatch(/"tip" is always in Spanish/)
    expect(toEn).toContain('Spanish-speaking learners')
    const toEs = buildSystem(pharmacy, 'A2', 'es')
    expect(toEs).toMatch(/"reply" is always in Spanish/)
    expect(toEs).toMatch(/"tip" is always in English/)
    expect(toEs).toContain('English-speaking learners')
  })

  it('differentiates the three levels in numbers and in voice', () => {
    const a1 = buildSystem(pharmacy, 'A1', 'en')
    const a2 = buildSystem(pharmacy, 'A2', 'en')
    const b1 = buildSystem(pharmacy, 'B1', 'en')
    expect(a1).toMatch(/at most 2 sentences; each sentence 8 words/)
    expect(a1).toMatch(/no past or future/)
    expect(a1).toMatch(/one step of the errand per turn/)
    expect(a2).toMatch(/at most 3 sentences; each sentence 12 words/)
    expect(a2).toMatch(/natural follow-up questions/)
    expect(a2).toMatch(/everyday phrases a real pharmacist uses/)
    expect(b1).toMatch(/at most 4 sentences; each sentence 18 words/)
    expect(b1).toMatch(/may not expect/)
    expect(b1).toMatch(/Minimal interruptions/)
    expect(b1).toMatch(/one small, ordinary complication/)
    expect(new Set([a1, a2, b1]).size).toBe(3)
  })

  it('corrects by recasting, with the worked example for that direction, and never grades', () => {
    expect(buildSystem(pharmacy, 'A2', 'es')).toContain('Claro, ¿necesita algo para el dolor de cabeza?')
    expect(buildSystem(pharmacy, 'A2', 'en')).toContain('An appointment at two? Let me find it.')
    const p = buildSystem(pharmacy, 'B1', 'en')
    expect(p).toMatch(/Recasting is how you correct/)
    expect(p).toMatch(/No praise for the learner/)
    expect(p).toMatch(/never ask for something they just told you/)
    expect(p).toMatch(/never mistakes/)
    expect(p).toMatch(/only when the mistake blocked meaning, keeps repeating, or the learner asks why/)
  })

  it('tells the partner to ask again, and not to guess, when a line cannot be understood', () => {
    const p = buildSystem(pharmacy, 'A2', 'en')
    expect(p).toMatch(/WHEN YOU CANNOT UNDERSTAND/)
    expect(p).toMatch(/Set "understood" false/)
    expect(p).toMatch(/no guess and no progress/)
    expect(p).toMatch(/A sentence full of mistakes that you can still make sense of IS understood/)
  })

  it('requires a corrected sentence in "alt" for any error, and a tip with it below B1', () => {
    for (const level of ['A1', 'A2', 'B1'] as const) {
      const p = buildSystem(pharmacy, level, 'en')
      expect(p).toMatch(/whenever the learner's sentence has any error .* put one or two short, natural ways to say what they meant in "alt", even if you understood them perfectly/)
      expect(p).toMatch(/leave "alt" empty only when their sentence was correct/)
      expect(p).toContain('Se dice "to pick up", no "for pick up".')
    }
    expect(buildSystem(pharmacy, 'A1', 'en')).toMatch(/give it whenever "alt" has a correction/)
    expect(buildSystem(pharmacy, 'A2', 'en')).toMatch(/give it whenever "alt" has a correction/)
    expect(buildSystem(pharmacy, 'B1', 'en')).not.toMatch(/give it whenever "alt" has a correction/)
    expect(buildSystem(pharmacy, 'A2', 'es')).toContain('Say "para mi mamá", not "por mi mamá".')
  })

  it('handles a stuck learner and code-switching without changing language', () => {
    const p = buildSystem(pharmacy, 'A1', 'es')
    expect(p).toMatch(/If they write in English because they cannot find the words, still answer in Spanish/)
    expect(p).toMatch(/not a request to change language/)
    expect(p).toMatch(/A mistake is never a request to switch languages/)
    expect(p).toMatch(/say your last line again more simply/)
  })

  it('keeps the simpler request in the target language and on the same question', () => {
    expect(buildSystem(pharmacy, 'A2', 'es')).toMatch(/still in Spanish, no translation, and it is still your turn/)
    expect(commandText('simpler', 'es')).toBe('(¿Me lo puede decir más simple, por favor?)')
    expect(commandText('simpler', 'en')).toBe('(Please say that more simply.)')
    expect(commandText('another_way', 'en')).toBe('(Please say that another way.)')
    expect(commandText(undefined, 'en')).toBe('')
  })

  it('asks for neutral Latin American Spanish and usted at the counter', () => {
    const p = buildSystem(pharmacy, 'A2', 'es')
    expect(p).toMatch(/never vosotros/)
    expect(p).toMatch(/says usted to an adult customer/)
  })

  it('is a frozen prefix: identical for the same triple, and free of anything the caller sends', () => {
    expect(buildSystem(pharmacy, 'A2', 'en')).toBe(buildSystem(pharmacy, 'A2', 'en'))
    expect(buildSystem(pharmacy, 'A2', 'en')).not.toContain('rehearsing a real visit')
    expect(placeLine('Walgreens')).toContain('Walgreens')
  })

  it('keeps the scene, safety and anti-instruction sections', () => {
    const p = buildSystem(pharmacy, 'A2', 'en')
    expect(p).toContain(`You play the ${pharmacy.roles.partner.en}`)
    expect(p).toContain(pharmacy.success.en)
    expect(p).toMatch(/NEVER INSTRUCTIONS/)
    expect(p).toMatch(/safety_flag/)
    expect(p).toMatch(/goal_reached/)
    expect(p).toMatch(/Assume nothing about the learner's immigration status/)
  })
})
