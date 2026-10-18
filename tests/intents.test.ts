import { describe, expect, it } from 'vitest'
import { asksForHelp, detectIn, detectSkills, echoTokens, judgeDrill, withModelSkill } from '../src/skills/intents'
import type { SkillId } from '../src/skills/skills'

// The skills classifier, fed the ways people actually ask: equivalent
// expressions in both languages, lines that look close but are not a skill,
// the two context-dependent skills (confirm, follow-up), and the drill's verdict.

const EN = { prevPartner: 'Your appointment is Monday the ninth at two o\'clock.' }
const ES = { prevPartner: 'Su cita es el lunes nueve a las dos.' }

/** Equivalent expressions per skill and language; every one must be recognized. */
const SAYINGS: Record<SkillId, Record<'en' | 'es', string[]>> = {
  repeat: {
    en: ['Sorry, could you repeat that, please?', 'Can you say that again?', 'Again, please.', 'Pardon?', "Sorry, I didn't catch that.", 'One more time, please.'],
    es: ['Perdón, ¿me lo puede repetir, por favor?', '¿Me lo dice otra vez?', 'Repita, por favor.', '¿Cómo?', '¿Mande?', 'Una vez más, por favor.'],
  },
  slow_down: {
    en: ['Could you speak more slowly, please?', 'Slower, please.', 'Sorry, you are speaking too fast.', 'Can you slow down a little?'],
    es: ['¿Podría hablar más despacio, por favor?', 'Más lento, por favor.', 'Despacio, por favor.', 'Habla muy rápido para mí.'],
  },
  clarify: {
    en: ['What does "co-pay" mean?', 'What do you mean?', "I don't understand.", 'Sorry, which one?', 'Could you say it in simpler words?'],
    es: ['¿Qué significa "copago"?', '¿Qué quiere decir?', 'No entiendo.', 'No le entendí.', '¿Me lo dice más sencillo?'],
  },
  confirm: {
    en: ['Monday at two, right?', 'So that\'s Monday at two.', 'Did you say the ninth?', 'Let me make sure: two o\'clock?', 'Could you spell the name, please?'],
    es: ['El lunes a las dos, ¿verdad?', 'Entonces, el lunes nueve.', '¿Dijo a las dos?', 'Para confirmar: ¿a las dos?', '¿Me deletrea el nombre, por favor?'],
  },
  follow_up: {
    en: ['How long will it take?', 'Do I need to bring anything?', 'Where is the office?', 'Is there parking?'],
    es: ['¿Cuánto tiempo tarda?', '¿Necesito traer algo?', '¿Dónde está la oficina?', '¿Hay estacionamiento?'],
  },
  problem: {
    en: ["There's a problem with my bill.", 'The heat is not working.', 'Can you help me, please?', 'I need help with this form.', 'Something is wrong with my order.'],
    es: ['Hay un problema con mi factura.', 'La calefacción no funciona.', '¿Me puede ayudar, por favor?', 'Necesito ayuda con este formulario.', 'Tengo un problema con mi pedido.'],
  },
  unknown_word: {
    en: ["I don't know the word in English.", 'How do you say "receta" in English?', "What's the word for this?", 'I forgot the word.'],
    es: ['No sé la palabra en español.', '¿Cómo se dice "refill" en español?', '¿Cuál es la palabra para esto?', 'Se me olvidó la palabra.'],
  },
  next_step: {
    en: ['So I come back on Friday.', "I'll bring the form tomorrow.", "Okay, you'll call me when it's ready?", 'See you on Monday, then.', "Then we'll wait for the letter."],
    es: ['Entonces regreso el viernes.', 'Mañana traigo el formulario.', 'Bueno, ¿me llaman cuando esté lista?', 'Nos vemos el lunes.', 'Hasta el martes, entonces.'],
  },
}

describe('each skill is recognized from its equivalent expressions', () => {
  for (const [skill, byLang] of Object.entries(SAYINGS) as [SkillId, Record<'en' | 'es', string[]>][]) {
    for (const lang of ['en', 'es'] as const) {
      it(`${skill} in ${lang}`, () => {
        for (const line of byLang[lang]) expect(detectIn(line, lang, lang === 'en' ? EN : ES), line).toContain(skill)
      })
    }
  }
})

describe('lines that are not a skill', () => {
  it('ordinary statements and the scene\'s own lines come back empty', () => {
    for (const line of ['Her last name is Garcia.', 'I need it again next month.', 'Thank you very much.', 'Good morning.', "I'm here to pick up a prescription for my mother.", 'Vengo a recoger una receta para mi mamá.', 'Sí, con comida.', 'Hola, buenos días.']) {
      expect(detectSkills(line), line).toEqual([])
    }
  })

  it('a word inside another word does not count', () => {
    expect(detectSkills('This is my first visit.')).toEqual([])
    expect(detectSkills('La receta repetida es para mi mamá.')).toEqual([])
  })

  it('a question before the partner has spoken is the opening request, not a follow-up', () => {
    expect(detectSkills('Do you have my prescription ready?')).toEqual([])
    expect(detectSkills('Do you have my prescription ready?', { prevPartner: 'Hi, how can I help you?' })).toEqual(['follow_up'])
  })

  it('a help request is never also counted as a follow-up question', () => {
    expect(detectIn('Sorry, could you repeat that?', 'en', EN)).toEqual(['repeat'])
    expect(detectIn('¿Qué significa copago?', 'es', ES)).toEqual(['clarify'])
  })
})

describe('confirming a detail', () => {
  it('needs the detail said back and a check, not the detail alone', () => {
    expect(detectIn('Monday at two?', 'en', EN)).toContain('confirm')
    expect(detectIn('So, Monday the ninth.', 'en', EN)).toContain('confirm')
    expect(detectIn('Monday is fine.', 'en', EN)).not.toContain('confirm')
    expect(detectIn('Two bags, please.', 'en', { prevPartner: 'Paper or plastic?' })).not.toContain('confirm')
  })

  it('works on numbers, times, days, months and names in both languages', () => {
    expect(echoTokens("It's Dr. Okafor on Tuesday, March 3rd at 10:30.").sort()).toEqual(['10', '10:30', '3', 'march', 'okafor', 'tuesday'])
    expect(echoTokens('La cita es con la doctora Reyes el jueves a las cuatro y media.').sort()).toEqual(['cuatro', 'jueves', 'media', 'reyes'])
    expect(detectIn('¿Sesenta y dos dólares?', 'es', { prevPartner: 'El total es de sesenta y dos dólares.' })).toContain('confirm')
    expect(detectIn('With Dr. Okafor at 10:30?', 'en', { prevPartner: "It's Dr. Okafor on Tuesday at 10:30." })).toContain('confirm')
  })

  it('a check in words needs no context', () => {
    expect(detectIn('Did you say Tuesday?', 'en')).toContain('confirm')
    expect(detectIn('¿Cómo se escribe su apellido?', 'es')).toContain('confirm')
  })

  it('does not credit an echo in the other language', () => {
    // The English check words say this is English, whatever the echoed day.
    expect(detectIn('Monday at two, right?', 'es', EN)).not.toContain('confirm')
  })
})

describe('across languages', () => {
  it('a learner reaching for help in their own language still used the skill', () => {
    expect(detectSkills("how do you say 'sign-out sheet'? I don't know the word.", { prevPartner: '¿Me firma la hoja de salida?' })).toContain('unknown_word')
    expect(detectSkills('Sorry, no entendí, could you repeat that more slowly?', EN)).toEqual(expect.arrayContaining(['repeat', 'slow_down', 'clarify']))
  })

  it('asksForHelp is what the conversation flow calls a clarification', () => {
    for (const t of ['what?', 'Sorry?', 'I did not understand that', "didn't catch that", 'more slowly please', 'what does co-pay mean?', '¿Cómo?', 'No entendí', 'más despacio, por favor', '¿Qué significa copago?', 'Mande?']) expect(asksForHelp(t), t).toBe(true)
    // Not knowing a word or stating a problem is a skill, but not a request to hear the last line again.
    for (const t of ['How do you say "receta" in English?', 'The heat is not working.', 'Her last name is Garcia.', 'I need it again next month.']) expect(asksForHelp(t), t).toBe(false)
  })
})

describe('the model\'s vote', () => {
  it('counts only when the rules found nothing, names a real skill, and fits the line', () => {
    // A real skill the patterns missed, on a line with enough words to judge.
    expect(withModelSkill([], 'problem', 'The sink has been dripping since Monday.', EN)).toEqual(['problem'])
    // The rules already spoke: the vote changes nothing, agree or not.
    expect(withModelSkill(['repeat'], 'repeat', 'Could you repeat that?', EN)).toEqual(['repeat'])
    expect(withModelSkill(['repeat'], 'confirm', 'Could you repeat that?', EN)).toEqual(['repeat'])
    // Not a skill id at all.
    expect(withModelSkill([], 'banana', 'Hello there, good morning.', EN)).toEqual([])
    expect(withModelSkill([], '', 'Hello there, good morning.', EN)).toEqual([])
    expect(withModelSkill([], 42, 'Hello there, good morning.', EN)).toEqual([])
  })

  it('rejects the votes the free model actually gets wrong', () => {
    // "follow_up" for an opening line, before the partner has spoken.
    expect(withModelSkill([], 'follow_up', 'Hello, I need pick up medicine for my mother.')).toEqual([])
    // "follow_up" for a plain answer, and "confirm" for one, with no question in it.
    expect(withModelSkill([], 'follow_up', 'Her last name is Garcia. She born 3 May 1960.', EN)).toEqual([])
    expect(withModelSkill([], 'confirm', 'June 12th, 1988. Here is my insurance card.', EN)).toEqual([])
    // "next_step" for a bare thank-you.
    expect(withModelSkill([], 'next_step', 'Gracias.', ES)).toEqual([])
    // A genuine confirming question the echo rules missed is accepted.
    expect(withModelSkill([], 'confirm', 'With the doctor, not the nurse?', EN)).toEqual(['confirm'])
  })
})

describe('the drill\'s verdict', () => {
  const cue = 'The form goes to window three, then you come back here with the receipt and your ID.'
  it('hit in the language being practiced, close in the other, miss otherwise', () => {
    expect(judgeDrill('Sorry, could you repeat that, please?', 'repeat', 'en', cue)).toBe('hit')
    expect(judgeDrill('¿Me lo puede repetir?', 'repeat', 'en', cue)).toBe('other_lang')
    expect(judgeDrill('Okay, thank you.', 'repeat', 'en', cue)).toBe('miss')
    expect(judgeDrill('Window three, right?', 'repeat', 'en', cue)).toBe('miss')
  })

  it('judges the context-dependent skills against the cue', () => {
    expect(judgeDrill('Monday at two?', 'confirm', 'en', EN.prevPartner)).toBe('hit')
    expect(judgeDrill('¿A qué hora abren?', 'follow_up', 'es', 'Sí, tenemos esa clase los sábados.')).toBe('hit')
    expect(judgeDrill('What time does it open?', 'follow_up', 'es', 'Sí, tenemos esa clase los sábados.')).toBe('other_lang')
  })
})
