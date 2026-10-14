// Text helpers shared by the conversation flow (flow.ts) and the skills
// classifier (src/skills/intents.ts). Nothing here knows about scenes or skills:
// it only folds text and finds words in it.

/** Lower-case, accent-free, single-spaced, so "¿Tiene...?" and "tiene" meet. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Did the learner use this must-use phrase? Punctuation on either end of the phrase does not count. */
export function usedPhrase(text: string, phrase: string): boolean {
  const p = fold(phrase).replace(/^[¿¡"'(\s]+|[.!?¿¡,;:"')\s]+$/g, '')
  return p.length > 0 && fold(text).includes(p)
}

/** True when `key` appears in `text` as whole words: "play" is not inside "playground", "hi" not inside "this". */
export function hasWords(text: string, key: string): boolean {
  const k = fold(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return k !== '' && new RegExp(`(?<![\\p{L}\\p{N}])${k}(?![\\p{L}\\p{N}])`, 'u').test(fold(text))
}

/** How many words carry a letter or a digit. */
export function words(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}
