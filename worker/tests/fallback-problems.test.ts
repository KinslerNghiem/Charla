import { describe, expect, it } from 'vitest'
import { fallbackProblems } from '../src/tutor'
import { sceneById } from '../../src/content/scenes'
import type { Turn } from '../../src/tutor/turn'
import type { Level } from '../../src/tutor/levels'

// The code checks that stand in for prompt obedience on the free model. Each
// case here is a reply gpt-oss or Llama actually produced, or the correct line
// that the check must not get in the way of.

const turn = (reply: string): Turn => ({ reply, tip: '', alt: [], on_topic: true, goal_reached: false, safety_flag: false, step: 0, gloss: '', suggest: '', skill: '' })
const mustUse = (id: string, lang: 'en' | 'es' = 'en') => sceneById(id)!.must_use.map((p) => p[lang])
const problems = (reply: string, level: Level = 'A2', scene = 'pharmacy-refill', learning: 'en' | 'es' = 'en') =>
  fallbackProblems(turn(reply), level, learning, mustUse(scene, learning))

describe('fallbackProblems', () => {
  it('lets the partner use scene vocabulary that is also on the learner list', () => {
    expect(problems('What is the name on the prescription?')).toEqual([])
    expect(problems('For here or to go?', 'A1', 'taqueria-order')).toEqual([])
    expect(problems('Do you have a library card with you?', 'A2', 'library-card')).toEqual([])
  })

  it('flags the learner\'s whole sentence spoken by the partner', () => {
    // Whichever learner sentence the pharmacy card ends with a question mark
    // ("Does she take it with food?" or its current wording), echoed back.
    const line = mustUse('pharmacy-refill').find((p) => /\?$/.test(p))!
    const out = problems('Sure. ' + line)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/learner's line/)
    expect(problems('Sure. Does she take it with food?', 'A2', 'pharmacy-refill')).toHaveLength(
      mustUse('pharmacy-refill').includes('Does she take it with food?') ? 1 : 0,
    )
  })

  it('flags a reply in the wrong language', () => {
    const out = problems('Bonjour, je suis le pharmacien. Vous avez votre ordonnance?')
    expect(out.some((p) => /must be in English/.test(p))).toBe(true)
  })

  it('flags a band violation', () => {
    const out = problems('I found the prescription for your mother and it is ready to pick up.', 'A1')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(/14 words, max 8/)
  })

  it('flags narration and bare questions, the live A1 failures', () => {
    const out = problems('I find it. What name?', 'A1')
    expect(out).toHaveLength(2)
    expect(out[0]).toMatch(/narrates/)
    expect(out[1]).toMatch(/not a complete question/)
    expect(problems('I make tacos. For here?', 'A1', 'taqueria-order')).toHaveLength(1)
    expect(problems('I check ID.', 'A1', 'school-office')).toHaveLength(1)
  })

  it('passes the same lines said the way a person would', () => {
    expect(problems('I found it. What is her name?', 'A1')).toEqual([])
    expect(problems("I'll check. One moment.", 'A1')).toEqual([])
    expect(problems('I look forward to seeing you.', 'A2')).toEqual([])
    expect(problems('Which one?', 'A1', 'ice-cream-shop')).toEqual([])
    expect(problems('Okay. Can I see your ID?', 'A1', 'school-office')).toEqual([])
  })

  it('does not measure a Spanish reply against English grammar', () => {
    expect(problems('Claro. ¿Cómo se llama ella?', 'A1', 'pharmacy-refill', 'es')).toEqual([])
    expect(problems('Lo busco. ¿Qué nombre?', 'A1', 'pharmacy-refill', 'es')).toEqual([])
  })
})
