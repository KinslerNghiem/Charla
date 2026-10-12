// Style checks that stand in for prompt obedience, on both model paths. A
// language model told to be a patient clerk still tends to grade the customer
// ("Great job!") and to open every turn the same way ("Claro. … Claro. …").
// The prompt forbids both; these catch the slip and the Worker asks once for
// a rewrite. Deterministic, a few microseconds, and tested on their own.

import type { HistoryItem } from './tutor'
import { looksLike } from '../../src/tutor/langcheck'

type Lang = 'en' | 'es'

// Praise aimed at the learner's language or effort. A clerk's "Perfect, one
// moment" or "Great, here you go" is acknowledgement and passes; "great job",
// "your English is very good" and "¡muy bien dicho!" are a teacher's lines.
const PRAISE_EN = /\b(great|good|nice|excellent|awesome|perfect|wonderful|fantastic|amazing)\s+(job|work|try|effort|question|english|spanish)\b|\bwell done\b|\byou(?:'re| are) doing (?:great|well|so well)\b|\byour (?:english|spanish) is\b|\bkeep (?:it )?up the good work\b/i
const PRAISE_ES =
  /(?<!\p{L})(?:buen|excelente|muy buen|gran) trabajo(?!\p{L})|(?<!\p{L})(?:muy )?bien dicho(?!\p{L})|(?<!\p{L})(?:qué|que) bien (?:habla|hablas|lo dijo|lo dijiste)(?!\p{L})|(?<!\p{L})(?:su|tu) (?:inglés|ingles|español|espanol) (?:es|está|esta)(?!\p{L})|(?<!\p{L})excelente pregunta(?!\p{L})|(?<!\p{L})felicidades(?!\p{L})|(?<!\p{L})buen intento(?!\p{L})/iu

export function praises(reply: string): boolean {
  return PRAISE_EN.test(reply) || PRAISE_ES.test(reply)
}

// Words that start many ordinary sentences and say nothing about the opener.
const DULL = new Set([
  ...['the', 'a', 'an', 'i', 'you', 'we', 'it', 'your', 'my', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'yes', 'no'],
  ...['el', 'la', 'los', 'las', 'un', 'una', 'su', 'sus', 'mi', 'yo', 'usted', 'ella', 'él', 'en', 'de', 'a', 'y', 'o', 'con', 'para', 'por', 'sí', 'si'],
])

/** The first word of a reply, letters only, or '' when it is too dull to count. */
export function opener(text: string): string {
  const first = text
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^\p{L}']/gu, '')
    .toLowerCase()
  return first && !DULL.has(first) ? first : ''
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** The partner's previous line, if the transcript has one. */
export function lastPartnerLine(history: HistoryItem[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) if (history[i].role === 'assistant') return history[i].content
  return null
}

// A quoted span inside a tip: the line the tip tells the learner to say.
const QUOTED = /["“«]([^"”»]{8,}?)["”»]/g

/**
 * A tip is written in the learner's own language and quotes the line to say
 * in the language they are learning. The free model sometimes quotes a line
 * in the learner's own language instead (seen live: a Spanish tip telling a
 * learner of English to say "¿Podría repetirlo más despacio?"). Such a tip
 * teaches nothing, so it is dropped; the "alt" list still carries the line.
 */
export function tipQuotesWrongLanguage(tip: string, learning: Lang): boolean {
  const native: Lang = learning === 'en' ? 'es' : 'en'
  let sawTarget = false
  let sawNativeOnly = false
  for (const m of tip.matchAll(QUOTED)) {
    const q = m[1]
    if (q.trim().split(/\s+/).length < 4) continue
    const t = looksLike(learning, q)
    const n = looksLike(native, q)
    if (t && !n) sawTarget = true
    else if (n && !t) sawNativeOnly = true
  }
  return sawNativeOnly && !sawTarget
}

/** The tip as the learner should see it: unchanged, or empty when it quotes the wrong language. */
export function cleanTip(tip: string, learning: Lang): string {
  return tip && tipQuotesWrongLanguage(tip, learning) ? '' : tip
}

/**
 * Problems with how the reply sounds, as short instructions for the rewrite
 * request. Empty when it sounds like a person.
 */
export function styleProblems(reply: string, history: HistoryItem[]): string[] {
  const out: string[] = []
  if (praises(reply)) out.push('it praises the learner ("great job", "your English is…"); a person behind the counter never grades the customer, so answer them instead')
  const prev = lastPartnerLine(history)
  if (prev) {
    if (normalize(prev) === normalize(reply)) out.push('it repeats your previous line word for word; say something new that moves the errand forward')
    else {
      const o = opener(reply)
      if (o && o === opener(prev)) out.push(`it opens with the same word as your previous line ("${o}"); start differently`)
    }
  }
  return out
}
