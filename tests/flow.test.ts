import { describe, expect, it } from 'vitest'
import { initialFlow, isClarification, isComplete, learnerTurn, likelyQuestions, matchesObjective, partnerTurn, summarize, MAX_LEARNER_TURNS, type FlowState } from '../src/tutor/flow'
import { sceneById } from '../src/content/scenes'

// The conversation state machine, walked the way conversations actually go:
// the straight path, the paraphrased path, the lost learner, the model that
// says "done" too early, and the one that never says it.

const pharmacy = sceneById('pharmacy-refill')!
const obj = pharmacy.must_use

const say = (s: FlowState, text: string, lang: 'en' | 'es' = 'en') => learnerTurn(s, text, lang, obj)
const reply = (s: FlowState, signal: Parameters<typeof partnerTurn>[1] = {}) => partnerTurn(s, signal)

describe('objectives', () => {
  it('match the phrase itself, its key words, or neither', () => {
    expect(matchesObjective("I'm here to pick up a prescription for my mother.", obj[0], 'en')).toBe(true)
    expect(matchesObjective("hi, i want to pick up my mom's medicine", obj[0], 'en')).toBe(true)
    expect(matchesObjective('Vengo a recoger la medicina de mi mama', obj[0], 'es')).toBe(true)
    expect(matchesObjective('Good morning.', obj[0], 'en')).toBe(false)
    expect(matchesObjective('Her last name is Lopez and she was born in 1960.', obj[1], 'en')).toBe(true)
    expect(matchesObjective('¿Lo toma con comida?', obj[2], 'es')).toBe(true)
  })
})

describe('the straight path', () => {
  it('walks START, GREETING, TASK, FOLLOW_UP, RESOLUTION, COMPLETE', () => {
    let s = initialFlow(3)
    expect(s.phase).toBe('start')
    s = say(s, 'Hello, good morning.')
    expect(s.phase).toBe('greeting')
    s = reply(s)
    s = say(s, "I'm here to pick up a prescription for my mother.")
    expect(s.phase).toBe('task')
    expect(s.done).toEqual([true, false, false])
    s = reply(s)
    s = say(s, 'Her last name is Garcia and her date of birth is May 3rd, 1960.')
    expect(s.phase).toBe('follow_up')
    s = reply(s)
    s = say(s, 'Should she take it with food?')
    expect(s.phase).toBe('resolution')
    expect(s.done).toEqual([true, true, true])
    expect(isComplete(s)).toBe(false)
    s = reply(s, { goal_reached: true })
    expect(s.phase).toBe('complete')
    expect(s.learnerTurns).toBe(4)
  })

  it('accepts objectives in any order and in the learner\'s own words', () => {
    let s = say(initialFlow(3), 'Does she take it with food? It is for my mom.')
    expect(s.done).toEqual([false, false, true])
    expect(s.phase).toBe('task')
    s = say(reply(s), 'i want to pick up her medicine, the last name is Garcia')
    expect(s.done).toEqual([true, true, true])
    expect(s.phase).toBe('resolution')
  })

  it('takes a validated step from the partner for a line the key words missed', () => {
    let s = say(initialFlow(3), 'Hello, I need the thing the doctor sent for my mom.')
    expect(s.done).toEqual([false, false, false])
    s = reply(s, { step: 1 })
    expect(s.done).toEqual([true, false, false])
    expect(s.phase).toBe('task')
    // Out of range or not an integer is ignored.
    expect(reply(s, { step: 9 }).done).toEqual([true, false, false])
    expect(reply(s, { step: 1.5 }).done).toEqual([true, false, false])
    expect(reply(s, { step: -1 }).done).toEqual([true, false, false])
  })
})

describe('clarification', () => {
  it('is a side step that returns where it left, in either language', () => {
    let s = say(initialFlow(3), "I'm here to pick up a prescription for my mother.")
    s = reply(s)
    expect(s.phase).toBe('task')
    s = say(s, 'Sorry, could you repeat that, please?')
    expect(s.phase).toBe('clarification')
    expect(s.clarifications).toBe(1)
    expect(s.resume).toBe('task')
    s = reply(s)
    expect(s.phase).toBe('clarification')
    s = say(s, 'Garcia.')
    expect(s.phase).toBe('task')
    s = say(reply(s), '¿Me lo puede repetir, por favor?', 'es')
    expect(s.phase).toBe('clarification')
    expect(s.clarifications).toBe(2)
  })

  it('counts the Simpler button as a clarification without a learner line', () => {
    let s = say(initialFlow(3), "I'm here to pick up a prescription for my mother.")
    s = learnerTurn(reply(s), '', 'en', obj, 'command')
    expect(s.phase).toBe('clarification')
    expect(s.learnerTurns).toBe(1)
    expect(s.clarifications).toBe(1)
  })

  it('recognizes the ways people say they are lost', () => {
    for (const t of ['what?', 'Sorry?', 'I did not understand that', "didn't catch that", 'more slowly please', 'what does co-pay mean?']) expect(isClarification(t, 'en'), t).toBe(true)
    for (const t of ['¿Cómo?', 'No entendí', 'más despacio, por favor', '¿Qué significa copago?', 'Mande?']) expect(isClarification(t, 'es'), t).toBe(true)
    for (const t of ['Her last name is Garcia.', 'Sí, con comida.', 'I need it again next month.']) expect(isClarification(t, 'en'), t).toBe(false)
  })

  it('a line that both clarifies and answers still covers its objective', () => {
    const s = say(initialFlow(3), "Sorry, could you repeat that? I'm here to pick up a prescription for my mother.")
    expect(s.phase).toBe('clarification')
    expect(s.done).toEqual([true, false, false])
    expect(say(reply(s), 'Garcia, May 3rd 1960, that is her date of birth.').phase).toBe('follow_up')
  })
})

describe('completion', () => {
  it('needs the partner to close once everything is covered', () => {
    let s = initialFlow(3)
    for (const line of ["I'm here to pick up a prescription for my mother.", 'Last name Garcia, date of birth May 3rd 1960.', 'Should she take it with food?']) s = reply(say(s, line))
    expect(s.phase).toBe('resolution')
    expect(reply(s, { goal_reached: true }).phase).toBe('complete')
  })

  it('accepts the partner closing early when at least half the errand is covered and two turns were said', () => {
    let s = reply(say(initialFlow(3), 'Hello.'), { goal_reached: true })
    expect(s.phase).not.toBe('complete')
    s = say(s, "I'm here to pick up a prescription for my mother. Her last name is Garcia.")
    expect(s.done).toEqual([true, true, false])
    expect(reply(s, { goal_reached: true }).phase).toBe('complete')
  })

  it('wraps up after the turn limit with whatever was covered', () => {
    let s = initialFlow(3)
    for (let i = 0; i < MAX_LEARNER_TURNS; i++) s = reply(say(s, `Line number ${i}.`))
    expect(s.phase).toBe('complete')
    expect(s.done).toEqual([false, false, false])
    expect(say(s, "I'm here to pick up a prescription for my mother.").phase).toBe('complete')
  })
})

describe('the summary', () => {
  it('names what was communicated, a strength and one thing to try, from what happened', () => {
    let s = initialFlow(3)
    s = reply(say(s, "I'm here to pick up a prescription for my mother."), { tip: 'Di "to pick up".' })
    s = reply(say(s, 'Sorry, could you repeat that?'))
    s = reply(say(s, 'Garcia, born May 3rd 1960.'), { goal_reached: true })
    const sum = summarize(s, obj, 'A2')
    expect(sum.communicated.map((p) => p.en)).toEqual([obj[0].en, obj[1].en])
    expect(sum.missed.map((p) => p.en)).toEqual([obj[2].en])
    expect(sum.strength).toBe('asked_repeat')
    expect(sum.improvement).toEqual({ key: 'missing', phrase: obj[2] })
  })

  it('prefers the last tip, then fuller sentences, then the next level, then the real visit', () => {
    let s = initialFlow(2)
    const two = obj.slice(0, 2)
    s = reply(learnerTurn(s, "I'm here to pick up a prescription for my mother.", 'en', two), { tip: 'A tip.' })
    s = reply(learnerTurn(s, 'Her last name is Garcia and her date of birth is May 3rd, 1960.', 'en', two), { goal_reached: true })
    expect(summarize(s, two, 'A2')).toMatchObject({ strength: 'all_phrases', improvement: { key: 'tip', text: 'A tip.' } })
    const short = reply(learnerTurn(reply(learnerTurn(initialFlow(2), 'pick up', 'en', two)), 'last name', 'en', two), { goal_reached: true })
    expect(summarize(short, two, 'A2').improvement).toEqual({ key: 'fuller' })
    const smooth = reply(learnerTurn(reply(learnerTurn(initialFlow(2), "I'm here to pick up a prescription for my mother.", 'en', two)), 'Her last name is Garcia and her date of birth is May 3rd, 1960.', 'en', two), { goal_reached: true })
    expect(summarize(smooth, two, 'A2').improvement).toEqual({ key: 'level_up' })
    expect(summarize(smooth, two, 'B1').improvement).toEqual({ key: 'go_real' })
  })
})

describe('likely questions', () => {
  it('come from the scene\'s own script, after the first question', () => {
    const qs = likelyQuestions(pharmacy, 'en')
    expect(qs.length).toBeGreaterThan(0)
    expect(qs.length).toBeLessThanOrEqual(3)
    expect(qs).not.toContain(pharmacy.expect!.en)
    for (const q of qs) expect(q).toMatch(/\?/)
    expect(likelyQuestions(pharmacy, 'es').every((q) => /¿/.test(q))).toBe(true)
  })
})
