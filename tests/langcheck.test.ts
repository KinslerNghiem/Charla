import { describe, expect, it } from 'vitest'
import { looksLike } from '../src/tutor/langcheck'

describe('looksLike', () => {
  it('accepts English replies as English', () => {
    expect(looksLike('en', 'Of course. What is her name?')).toBe(true)
    expect(looksLike('en', 'Sure, I can help you with that. Do you have your ID?')).toBe(true)
  })
  it('accepts Spanish replies as Spanish', () => {
    expect(looksLike('es', 'Claro. ¿Cuál es el nombre de su mamá?')).toBe(true)
    expect(looksLike('es', 'Muy bien, ¿para aquí o para llevar?')).toBe(true)
  })
  it('rejects a French reply where English was expected', () => {
    expect(looksLike('en', 'Bonjour, je suis le préposé au comptoir.')).toBe(false)
  })
  it('rejects a Spanish reply where English was expected', () => {
    expect(looksLike('en', 'Claro, ¿me da el nombre de su mamá, por favor?')).toBe(false)
  })
  it('rejects an English reply where Spanish was expected', () => {
    expect(looksLike('es', 'Sure, what is the name on the prescription?')).toBe(false)
  })
  it('lets very short replies through', () => {
    expect(looksLike('en', 'Okay.')).toBe(true)
    expect(looksLike('es', 'Sí.')).toBe(true)
  })
  it('does not punish a name or a menu item', () => {
    expect(looksLike('en', 'Two chicken tacos and one horchata. Anything else?')).toBe(true)
  })
})
