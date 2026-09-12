import { describe, expect, it } from 'vitest'
import { checkReply, countWords, simplerThan, splitSentences } from '../src/tutor/levels'

describe('drift guard', () => {
  it('splits sentences on . ! ? and newlines', () => {
    expect(splitSentences('Sure. What is her last name? Thanks!')).toEqual(['Sure.', 'What is her last name?', 'Thanks!'])
    expect(splitSentences('Claro.\n¿Cuál es su apellido?')).toEqual(['Claro.', '¿Cuál es su apellido?'])
  })

  it('counts words, including accented ones, and ignores bare punctuation', () => {
    expect(countWords('¿Lo toma con comida?')).toBe(4)
    expect(countWords('Yes - with food.')).toBe(3)
  })

  it('accepts a short A1 reply', () => {
    expect(checkReply('Sure. What is her last name?', 'A1').ok).toBe(true)
  })

  it('rejects a 14-word sentence at A1 and accepts it at B1', () => {
    const mid = 'I found the prescription for your mother and it is ready to pick up.'
    expect(countWords(mid)).toBe(14)
    expect(checkReply(mid, 'A1').ok).toBe(false)
    expect(checkReply(mid, 'A1').violations.join(' ')).toMatch(/words/)
    expect(checkReply(mid, 'A2').ok).toBe(false)
    expect(checkReply(mid, 'B1').ok).toBe(true)
  })

  it('rejects a 24-word sentence even at B1', () => {
    const long = 'I found the prescription for your mother and it is ready, but the pharmacist would like to talk to you about the dosage first.'
    expect(countWords(long)).toBe(24)
    expect(checkReply(long, 'B1').ok).toBe(false)
  })

  it('rejects too many sentences and too many questions', () => {
    expect(checkReply('Hi. Yes. No. Maybe.', 'A1').violations.join(' ')).toMatch(/sentences/)
    expect(checkReply('Name? Birthday?', 'A2').violations.join(' ')).toMatch(/questions/)
  })

  it('steps down one level and stops at A1', () => {
    expect(simplerThan('B1')).toBe('A2')
    expect(simplerThan('A2')).toBe('A1')
    expect(simplerThan('A1')).toBe('A1')
  })
})
