import { describe, expect, it } from 'vitest'
import { looksGarbled } from '../src/tutor/garbled'

// The lines from a real session that the partner answered as if it had
// understood them, and the real lines that must keep passing.
describe('a line nobody could answer', () => {
  it('is caught by its shape', () => {
    for (const line of [
      'Hello, Medicine 4 Upkick My 4 Mother 4.',
      'Money, money, money, cats, but, farts, barbie-corns.',
      'asdf qwertzxcv plmkjhgf',
      '1 2 3 4 5 6',
      '??? !!! 123 ### 456 @@@ abc',
      'no no no no',
    ]) {
      expect(looksGarbled(line), line).toBe(true)
    }
  })

  it('lets every real learner line through', () => {
    for (const line of [
      'Hello, I need for pick up medicine for my mother.',
      'Her last name is Garcia. She born 3 May 1960.',
      'Su apellido es García y nació el 3 de mayo de 1960.',
      '10:30?',
      '¡Gracias!',
      'Ok.',
      'Quiero pick up mi receta para mi mamá, please.',
      'My phone number is 630-555-1234.',
      'Two tacos and one horchata, please.',
      'Rhythm, strengths, Krzysztof, Schmidt.',
      'Sí, sí, con comida.',
      "Hmm, I don't know.",
    ]) {
      expect(looksGarbled(line), line).toBe(false)
    }
  })
})
