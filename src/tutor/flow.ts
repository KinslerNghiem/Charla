import type { Lang, Phrase, Scene } from '../content/scene.schema'
import type { Level } from './levels'
import { hasWords, usedPhrase, words } from './text'
import { asksForHelp } from '../skills/intents'

// The conversation's state machine. The model plays the person behind the
// counter; this file decides where the errand stands, in code the app and the
// Worker both run:
//
//   START → GREETING → TASK → FOLLOW_UP → RESOLUTION → COMPLETE
//                        ↘  CLARIFICATION  ↙   (a side step; returns where it left)
//
// The learner's objectives are the scene's must-use lines. A line counts as
// covered when the learner says it, says something with the same key words
// (scene-authored `keys`, so "I want to pick up my mom's medicine" counts for
// "I'm here to pick up a prescription for my mother"), or the model reports
// that the learner's turn accomplished it (`step`, validated by the Worker).
// Nothing here calls a model; every transition is a pure function with a test.

export type Phase = 'start' | 'greeting' | 'task' | 'follow_up' | 'clarification' | 'resolution' | 'complete'

export const PHASES: Phase[] = ['start', 'greeting', 'task', 'follow_up', 'clarification', 'resolution', 'complete']

export interface FlowState {
  phase: Phase
  /** One flag per objective (the scene's must-use lines), in order. */
  done: boolean[]
  /** Learner turns that were real lines, not Simpler or Another-way requests. */
  learnerTurns: number
  /** Times the learner asked for a repeat, simpler words or a meaning. */
  clarifications: number
  /** Where to go back to after a clarification. */
  resume: Phase
  /** The partner reported that the scene's success condition happened. */
  partnerClosed: boolean
  /** Tips the partner gave, oldest first. */
  tips: string[]
  /** Word count of each real learner turn. */
  words: number[]
}

/** After this many real learner turns the scene wraps up with whatever was covered. */
export const MAX_LEARNER_TURNS = 10

export function initialFlow(objectives: number): FlowState {
  return { phase: 'start', done: Array.from({ length: objectives }, () => false), learnerTurns: 0, clarifications: 0, resume: 'greeting', partnerClosed: false, tips: [], words: [] }
}

export { fold, hasWords, usedPhrase } from './text'

/** The phrase itself, or any of its key words for that language. */
export function matchesObjective(text: string, p: Phrase, lang: Lang): boolean {
  if (usedPhrase(text, p[lang])) return true
  return (p.keys?.[lang] ?? []).some((k) => hasWords(text, k))
}

/**
 * A turn that asks for help understanding, in either language: a repeat, a
 * slower pace, a meaning. The patterns live with the other communication
 * skills in src/skills/intents.ts, so the drill and the flow agree on them.
 */
export function isClarification(text: string, _lang: Lang): boolean {
  return asksForHelp(text)
}

/** What the learner can say when lost, in the language they are practicing. Usted: they are talking to staff. */
export const RECOVERY_LINES: Record<Lang, { repeat: string; simpler: string; meaning: string }> = {
  en: { repeat: 'Sorry, could you repeat that, please?', simpler: 'Could you say that more simply?', meaning: 'Sorry, what does that mean?' },
  es: { repeat: 'Perdón, ¿me lo puede repetir, por favor?', simpler: '¿Me lo puede decir más simple?', meaning: 'Perdón, ¿qué significa eso?' },
}

function countDone(done: boolean[]): number {
  return done.filter(Boolean).length
}

/** The phase that progress alone implies: how much of the errand is covered. */
function phaseFor(done: boolean[], learnerTurns: number): Phase {
  const n = countDone(done)
  if (learnerTurns === 0) return 'start'
  if (done.length > 0 && n === done.length) return 'resolution'
  if (n >= 2) return 'follow_up'
  if (n === 1) return 'task'
  return 'greeting'
}

/**
 * The learner spoke. `kind` is 'text' for a real line and 'command' for the
 * Simpler and Another-way buttons, which are clarifications that add no line.
 */
export function learnerTurn(state: FlowState, text: string, lang: Lang, objectives: Phrase[], kind: 'text' | 'command' = 'text'): FlowState {
  if (state.phase === 'complete') return state
  const next: FlowState = { ...state, done: [...state.done], tips: [...state.tips], words: [...state.words] }
  const clarifying = kind === 'command' || isClarification(text, lang)
  if (kind === 'text') {
    next.learnerTurns++
    next.words.push(words(text))
    objectives.forEach((p, i) => {
      if (!next.done[i] && matchesObjective(text, p, lang)) next.done[i] = true
    })
  }
  if (clarifying) {
    next.clarifications++
    if (state.phase !== 'clarification') next.resume = state.phase === 'start' ? 'greeting' : state.phase
    next.phase = 'clarification'
    return next
  }
  const progress = phaseFor(next.done, next.learnerTurns)
  // Coming back from a clarification lands where the errand stood, or further if this line covered something.
  next.phase = state.phase === 'clarification' ? later(next.resume, progress) : later(state.phase, progress)
  return next
}

const ORDER: Phase[] = ['start', 'greeting', 'task', 'follow_up', 'resolution', 'complete']
function later(a: Phase, b: Phase): Phase {
  if (a === 'clarification') return b
  return ORDER.indexOf(b) >= ORDER.indexOf(a) ? b : a
}

/** What the Worker sends back about the partner's turn, as far as the flow cares. */
export interface PartnerSignal {
  /** 1-based index of the objective the learner's last turn accomplished, 0 for none. */
  step?: number
  goal_reached?: boolean
  tip?: string
}

/** The partner answered. The validated `step` can cover an objective the key words missed. */
export function partnerTurn(state: FlowState, signal: PartnerSignal): FlowState {
  if (state.phase === 'complete') return state
  const next: FlowState = { ...state, done: [...state.done], tips: [...state.tips], words: [...state.words] }
  const s = signal.step ?? 0
  if (Number.isInteger(s) && s >= 1 && s <= next.done.length) next.done[s - 1] = true
  if (signal.tip) next.tips.push(signal.tip)
  if (signal.goal_reached) next.partnerClosed = true
  if (isComplete(next)) {
    next.phase = 'complete'
    return next
  }
  // A clarification stays open until the learner's next real line.
  if (next.phase !== 'clarification') next.phase = later(next.phase, phaseFor(next.done, next.learnerTurns))
  return next
}

/**
 * The success condition, in code: every objective covered and the partner has
 * closed the errand; or the partner closed it and at least half the
 * objectives are covered (the learner said it in their own words); or the
 * learner has had enough turns, and the scene ends with what was covered.
 */
export function isComplete(s: FlowState): boolean {
  const n = countDone(s.done)
  const all = s.done.length > 0 && n === s.done.length
  if (all && s.partnerClosed) return true
  if (s.partnerClosed && n >= Math.ceil(s.done.length / 2) && s.learnerTurns >= 2) return true
  return s.learnerTurns >= MAX_LEARNER_TURNS
}

export type Strength = 'all_phrases' | 'asked_repeat' | 'full_sentences' | 'kept_going' | 'no_repeat'
export type Improvement = { key: 'missing'; phrase: Phrase } | { key: 'tip'; text: string } | { key: 'fuller' } | { key: 'level_up' } | { key: 'go_real' }

export interface Summary {
  communicated: Phrase[]
  missed: Phrase[]
  strength: Strength
  improvement: Improvement
}

/**
 * The end-of-scene summary. Everything in it is something the app observed:
 * which lines were covered, whether the learner asked for help, how long their
 * turns were, which tips came up. No scores, no claims about fluency.
 */
export function summarize(s: FlowState, objectives: Phrase[], level: Level): Summary {
  const communicated = objectives.filter((_, i) => s.done[i])
  const missed = objectives.filter((_, i) => !s.done[i])
  const avg = s.words.length ? s.words.reduce((a, b) => a + b, 0) / s.words.length : 0
  let strength: Strength
  if (missed.length === 0 && objectives.length > 0) strength = 'all_phrases'
  else if (s.clarifications > 0) strength = 'asked_repeat'
  else if (avg >= 5) strength = 'full_sentences'
  else if (s.learnerTurns >= 4) strength = 'kept_going'
  else strength = 'no_repeat'
  let improvement: Improvement
  if (missed.length > 0) improvement = { key: 'missing', phrase: missed[0] }
  else if (s.tips.length > 0) improvement = { key: 'tip', text: s.tips[s.tips.length - 1] }
  else if (avg > 0 && avg < 4) improvement = { key: 'fuller' }
  else if (level !== 'B1' && s.clarifications === 0) improvement = { key: 'level_up' }
  else improvement = { key: 'go_real' }
  return { communicated, missed, strength, improvement }
}

/**
 * Questions the learner may hear, taken from the scene's own script: every
 * partner line that asks something, after the first question (`expect`).
 */
export function likelyQuestions(scene: Scene, lang: Lang, max = 3): string[] {
  const first = scene.expect?.[lang]
  const out: string[] = []
  for (const node of Object.values(scene.offline_script.nodes)) {
    const line = node.partner[lang]
    if (!/\?/.test(line)) continue
    // The question itself, not the sentence before it ("Sure. What's her last name?").
    const q = line.split(/(?<=[.!])\s+/).find((part) => /\?/.test(part)) ?? line
    if (q === first || line === first || out.includes(q)) continue
    out.push(q)
    if (out.length >= max) break
  }
  return out
}
