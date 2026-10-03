// The drift guard. Language models slide toward native-level complexity within a
// few turns even when told a level. The prompt asks for a level; this file checks
// it, and the Worker re-requests once when a reply breaks the rules.
// Shared by the app (for the "Simpler" button) and the Worker (for the check).

import type { Level } from '../content/scene.schema'
export type { Level }

export interface Band {
  maxWordsPerSentence: number
  maxSentences: number
  maxQuestions: number
}

export const BANDS: Record<Level, Band> = {
  A1: { maxWordsPerSentence: 8, maxSentences: 2, maxQuestions: 1 },
  A2: { maxWordsPerSentence: 12, maxSentences: 3, maxQuestions: 1 },
  B1: { maxWordsPerSentence: 18, maxSentences: 4, maxQuestions: 2 },
}

export const LEVELS: Level[] = ['A1', 'A2', 'B1']

export function simplerThan(level: Level): Level {
  const i = LEVELS.indexOf(level)
  return LEVELS[Math.max(0, i - 1)]
}

// Titles and clock abbreviations end in a period without ending a sentence.
// "Dr. Lopez will see you at 3:30 p.m. today." is one sentence, not three.
// The period is swapped for a placeholder before the split and put back after.
// "No." only when a number follows ("No. 4"): on its own it is a whole answer.
const ABBREV = /\b(Dr|Mr|Mrs|Ms|St|Sr|Sra|Srta|Dra|a\.m|p\.m)\.|\bNo\.(?=\s?\d)/gi
const DOT = '\u0000'

export function splitSentences(text: string): string[] {
  const guarded = text.replace(ABBREV, (m) => m.replaceAll('.', DOT))
  return guarded
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replaceAll(DOT, '.'))
    .filter(Boolean)
}

export function countWords(sentence: string): number {
  return sentence.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

export interface Check {
  ok: boolean
  violations: string[]
}

export function checkReply(text: string, level: Level): Check {
  const band = BANDS[level]
  const sentences = splitSentences(text)
  const violations: string[] = []
  if (sentences.length > band.maxSentences) {
    violations.push(`${sentences.length} sentences, max ${band.maxSentences}`)
  }
  const questions = (text.match(/\?/g) ?? []).length
  if (questions > band.maxQuestions) {
    violations.push(`${questions} questions, max ${band.maxQuestions}`)
  }
  for (const s of sentences) {
    const n = countWords(s)
    if (n > band.maxWordsPerSentence) {
      violations.push(`"${s.slice(0, 40)}" has ${n} words, max ${band.maxWordsPerSentence}`)
    }
  }
  return { ok: violations.length === 0, violations }
}

// About 60 tokens each. Injected after every learner turn so the level rule is
// always the most recent instruction the model sees.
export const LEVEL_REMINDER: Record<Level, string> = {
  A1: 'Level reminder: the learner is A1. At most 2 sentences, each 8 words or fewer. One question at most. Present tense and short polite requests (Tome asiento / Please have a seat) are fine; no past or future. Everyday words only. Reply in the target language.',
  A2: 'Level reminder: the learner is A2. At most 3 sentences, each 12 words or fewer. One question at most. Simple past and future are fine. Reply in the target language.',
  B1: 'Level reminder: the learner is B1. At most 4 sentences, each 18 words or fewer. Up to 2 questions. Connectors and opinions are fine. Reply in the target language.',
}
