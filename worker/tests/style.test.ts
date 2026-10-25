import { describe, expect, it } from 'vitest'
import { cleanTip, opener, praises, styleProblems, tipQuotesWrongLanguage } from '../src/style'

// A clerk acknowledges; a teacher grades. The checks must tell them apart in
// both languages, and must notice a partner that opens every turn the same way.

describe('praises', () => {
  it('catches grading in English and Spanish', () => {
    for (const r of [
      'Great job! What is her name?',
      'Perfect English! What is her name?',
      'Your English is very good. One moment.',
      'Well done. Here you go.',
      '¡Muy bien dicho! ¿Algo más?',
      '¡Buen trabajo! Aquí tiene su receta.',
      'Felicidades, su inglés es excelente.',
      'Excelente pregunta. Sí, con comida.',
    ]) {
      expect(praises(r), r).toBe(true)
    }
  })

  it('lets a clerk acknowledge', () => {
    for (const r of [
      'Perfect, one moment.',
      'Great, here you go.',
      'Good morning. How can I help you?',
      'Nice to meet you. What do you need?',
      'Perfecto, aquí tengo su cita.',
      'Muy bien, pasó. Aquí tiene su número.',
      'Excelente. ¿Algo más?',
      'Claro que sí. ¿Trae su tarjeta del seguro?',
    ]) {
      expect(praises(r), r).toBe(false)
    }
  })
})

describe('opener', () => {
  it('takes the first real word and ignores articles, pronouns and prepositions', () => {
    expect(opener('Claro. ¿Cuál es su apellido?')).toBe('claro')
    expect(opener('¿En qué le puedo ayudar?')).toBe('')
    expect(opener('The pharmacist will be right with you.')).toBe('')
    expect(opener('Sure, one moment.')).toBe('sure')
    expect(opener('')).toBe('')
  })
})

describe('tipQuotesWrongLanguage', () => {
  it('catches a tip that quotes the learner\'s own language as the line to say (seen on the free model)', () => {
    expect(tipQuotesWrongLanguage('Di: "¿Podría repetirlo más despacio, por favor?"', 'en')).toBe(true)
    expect(tipQuotesWrongLanguage('Say "I need something for a headache" to the pharmacist.', 'es')).toBe(true)
    expect(cleanTip('Di: "¿Podría repetirlo más despacio, por favor?"', 'en')).toBe('')
  })

  it('reads single and curly quotes too, without tripping on apostrophes (seen live: a Spanish line in single quotes)', () => {
    expect(cleanTip("Di: 'Su apellido es García y su fecha de nacimiento es el 3 de mayo de 1960.'", 'en')).toBe('')
    expect(cleanTip('Say: ‘I am here to pick up a prescription for my mother.’', 'es')).toBe('')
    expect(cleanTip("Di: 'I'm here to pick up a prescription for my mother.'", 'en')).toBe("Di: 'I'm here to pick up a prescription for my mother.'")
    expect(cleanTip('Say: ‘Vengo a recoger una receta para mi mamá.’', 'es')).toBe('Say: ‘Vengo a recoger una receta para mi mamá.’')
    expect(cleanTip("Don't say \"for pick up\"; it's \"to pick up\".", 'en')).toBe("Don't say \"for pick up\"; it's \"to pick up\".")
  })

  it('keeps a tip that quotes the target language, explains without quoting, or quotes both', () => {
    expect(tipQuotesWrongLanguage('Di: "Could you repeat that more slowly, please?"', 'en')).toBe(false)
    expect(tipQuotesWrongLanguage('Say "necesito algo para el dolor de cabeza": the pain comes after.', 'es')).toBe(false)
    expect(tipQuotesWrongLanguage('En inglés la edad se dice con "is", no con "has".', 'en')).toBe(false)
    expect(tipQuotesWrongLanguage('"Estoy mal" en inglés es "I do not feel well today".', 'en')).toBe(false)
    expect(cleanTip('', 'en')).toBe('')
    expect(cleanTip('Di: "Could you repeat that, please?"', 'en')).toBe('Di: "Could you repeat that, please?"')
  })
})

describe('styleProblems', () => {
  const history = [
    { role: 'user' as const, content: 'Hello, I need to pick up medicine.' },
    { role: 'assistant' as const, content: 'Sure. What is her last name?' },
    { role: 'user' as const, content: 'Garcia.' },
  ]

  it('is quiet for a reply that sounds like a person', () => {
    expect(styleProblems('Thank you. Let me check. One moment.', history)).toEqual([])
    expect(styleProblems('Sure, anything at all.', [])).toEqual([])
  })

  it('flags praise, a repeated line and a repeated opener', () => {
    expect(styleProblems('Great job! Let me check.', history).join(' ')).toMatch(/praises/)
    expect(styleProblems('Sure. What is her last name?', history).join(' ')).toMatch(/word for word/)
    expect(styleProblems('Sure, here it is.', history).join(' ')).toMatch(/same word as your previous line \("sure"\)/)
  })

  it('does not count a dull first word as a repeated opener', () => {
    const h = [{ role: 'assistant' as const, content: 'The medicine is ready.' }]
    expect(styleProblems('The total is twelve dollars.', h)).toEqual([])
  })
})
