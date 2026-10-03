import { describe, expect, it } from 'vitest'
import { usedPhrase } from '../src/pages/Learn'

// The must-use chips tick from what the learner typed or said, so the match
// has to survive the ways people actually write: no accents, odd case, the
// phrase mid-sentence, Whisper's own punctuation.
describe('must-use phrase matching', () => {
  it('folds case and accents', () => {
    expect(usedPhrase('necesito una CITA para manana', 'Necesito una cita')).toBe(true)
    expect(usedPhrase('Necesito una cita', 'necesito una cita')).toBe(true)
  })

  it('finds the phrase inside a longer line', () => {
    expect(usedPhrase('Hola, buenas tardes. ¿Tiene mi receta lista?', '¿Tiene mi receta?')).toBe(true)
  })

  it('ignores punctuation on the phrase but not its words', () => {
    expect(usedPhrase('I need a refill', 'I need a refill.')).toBe(true)
    expect(usedPhrase('I need a cat', 'I need a refill.')).toBe(false)
  })

  it('never matches an empty phrase', () => {
    expect(usedPhrase('anything', '?')).toBe(false)
  })
})
