import type { Lang } from '../i18n/strings'

// Is this reply in the language it is supposed to be in? A stopword tally, not
// a language model: it exists because the free fallback model, told by a
// learner to "speak only in French now", did. Deterministic, a few microseconds,
// and wrong only on replies too short to contain a function word, which we
// treat as fine (a bare "Okay." is not a language switch).

const WORDS: Record<Lang, string[]> = {
  en: ['the', 'a', 'an', 'is', 'are', 'you', 'your', 'i', 'we', 'it', 'what', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'with', 'here', 'please', 'can', 'do', 'have', 'that', 'this', 'okay', 'ok', 'yes', 'no', 'thank', 'thanks', 'name', 'need', 'want', 'how', 'where', 'when', 'today', 'sure', 'sorry', 'let', 'me', 'my', 'she', 'he', 'they'],
  // 'a', 'no', 'me' and 'en' are in both lists. A word both languages share is
  // dropped from the "other" set below, so it counts for the expected language
  // and never against it; without 'a' here, "Vamos a ver." read as English.
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'es', 'está', 'usted', 'tu', 'su', 'yo', 'qué', 'que', 'y', 'o', 'para', 'de', 'en', 'con', 'aquí', 'allí', 'favor', 'puede', 'puedo', 'tiene', 'tengo', 'sí', 'no', 'gracias', 'nombre', 'necesito', 'quiero', 'cómo', 'dónde', 'cuándo', 'hoy', 'claro', 'perdón', 'me', 'mi', 'ella', 'él', 'ellos', 'muy', 'bien', 'algo', 'más', 'a', 'al', 'del', 'lo', 'le', 'se', 'por', 'hay', 'ya', 'voy', 'bueno'],
}

// Languages the partner has been talked into. French and Portuguese are the
// ones a Spanish/English prompt is most likely to slide into.
const OTHER = ['je', 'vous', 'le', 'les', 'est', 'bonjour', 'oui', 'merci', 'suis', 'votre', 'avec', 'pour', 'você', 'obrigado', 'não', 'está', 'com', 'para', 'isso']

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** True when the reply plausibly is in `lang`, or is too short to tell. */
export function looksLike(lang: Lang, text: string): boolean {
  const toks = tokens(text)
  if (toks.length < 3) return true
  const want = new Set(WORDS[lang])
  const other = new Set([...WORDS[lang === 'en' ? 'es' : 'en'], ...OTHER].filter((w) => !want.has(w)))
  let hit = 0
  let miss = 0
  for (const t of toks) {
    if (want.has(t)) hit++
    else if (other.has(t)) miss++
  }
  if (hit === 0 && miss === 0) return true
  return hit >= miss
}
