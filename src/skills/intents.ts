import type { Lang } from '../content/scene.schema'
import { fold, hasWords, words } from '../tutor/text'
import { looksLike } from '../tutor/langcheck'
import { isSkillId, type SkillId } from './skills'

// Which communication skill is the learner using? A rule-based classifier a
// reader can check line by line: one set of patterns per skill per language,
// each one a thing people actually say, run on folded text (lower-case, accents
// stripped) so "¿Qué significa?" and "que significa" meet. Nothing is scored;
// a skill either shows in the words or it does not.
//
// Two skills need more than the words themselves. "Confirm" is recognized
// when the learner says a detail back (a number, a day, a time, a name from
// the partner's last line) and checks it; "follow-up question" is any real
// question that is not one of the other skills, asked after the partner has
// said something. Both take the partner's previous line as context.
//
// The flow (src/tutor/flow.ts) asks this file whether a turn was a request for
// help understanding; the Skills drill asks whether a turn used one skill in
// one language; the conversation asks which skills a turn used in either.

export interface TurnContext {
  /** What the partner said just before this turn, in the language being practiced. */
  prevPartner?: string
}

/** Skills whose use is a request for help understanding the previous line; the flow treats these as a clarification. */
export const CLARIFYING: ReadonlySet<SkillId> = new Set<SkillId>(['repeat', 'slow_down', 'clarify'])

/** The skills that are plain requests: one line, one intent, so a line is at most one of them for the drill's purposes. */
export const HELP_SKILLS: readonly SkillId[] = ['repeat', 'slow_down', 'clarify', 'unknown_word', 'problem']

type Worded = Exclude<SkillId, 'confirm' | 'follow_up'>

// Written against folded text: no accents, no capitals. "?" and "¿" survive folding.
const PATTERNS: Record<Worded, Record<Lang, RegExp>> = {
  repeat: {
    en: /\brepeat\b|\bsay (that|it) again\b|\bagain,? please\b|\bone more time\b|\bcome again\b|\bpardon\b|\bsorry\?|\bwhat\?|\b(didn'?t|did not|couldn'?t|could not) (catch|get|hear)( that| it)?\b/,
    es: /\brepetir\w*\b|\brepit[ae]\w*\b|\botra vez\b|\bde nuevo\b|\buna vez mas\b|\bperdon\?|\bcomo\?|\bmande\?|\bdisculpe\?|\bno (le |lo )?(escuche|oi)\b/,
  },
  slow_down: {
    en: /\bslow(er|ly)\b|\bslow down\b|\btoo fast\b|\bnot so fast\b|\bspeak slow\b/,
    es: /\bmas despacio\b|\bmas lento\b|\bdespacio,? por favor\b|\bhabla(s)? (muy|tan) rapido\b|\bmuy rapido para mi\b/,
  },
  clarify: {
    en: /\bwhat does .{1,40} mean\b|\bwhat (do you|does that|does this|does it) mean\b|\bdo you mean\b|\bi (don'?t|do not) understand\b|\b(didn'?t|did not) understand\b|\bnot sure what you\b|\bwhich one\?|\bsimpler\b|\bmore simple\b|\beasier words\b|\bin other words\b|\bi'?m confused\b/,
    es: /\bque significa\b|\bque quiere decir\b|\bno (le |lo |te )?entiend\w*\b|\bno (le |lo |te )?entendi\b|\bno (le |lo )?comprend\w*\b|\bmas simple\b|\bmas sencillo\b|\bmas facil\b|\bcual\?|\bcomo asi\?|\ba que se refiere\b|\bno le sigo\b/,
  },
  unknown_word: {
    en: /\b(don'?t|do not|didn'?t) know (the|that|this|a) word\b|\bhow do (you|i|we) say\b|\bhow to say\b|\bwhat'?s the word\b|\bwhat is the word\b|\bthe word for\b|\bforgot the word\b|\bnot sure of the word\b|\bthe word in (english|spanish)\b/,
    es: /\bno se (la|esa|esta) palabra\b|\bcomo se dice\b|\bcual es la palabra\b|\bla palabra para\b|\bno (me acuerdo|recuerdo) (de )?la palabra\b|\bse me olvido la palabra\b|\bla palabra en (ingles|espanol)\b|\bcomo se llama (esto|eso)\b/,
  },
  problem: {
    en: /\b(there'?s|there is|i have|we have|i'?ve got) (a |an |one )?(problem|issue)\b|\bproblem with\b|\b(doesn'?t|does not|isn'?t|is not|won'?t|will not|didn'?t|did not|not) work(ing)?\b|\bis broken\b|\bstopped working\b|\b(can|could|would) you help\b|\bi need help\b|\bhelp me\b|\bsomething('?s| is) wrong\b|\bis leaking\b|\bno (hot )?water\b|\bno heat\b/,
    es: /\bhay un problema\b|\btengo un problema\b|\bun problema con\b|\bno funciona\b|\bno sirve\b|\bno prende\b|\bno enciende\b|\besta (roto|rota|descompuesto|descompuesta)\b|\bse (rompio|descompuso)\b|\bme puede ayudar\b|\b(podria|puede) ayudarme\b|\bnecesito ayuda\b|\bayud[ea]me\b|\balgo esta mal\b|\bno hay (agua|luz|calefaccion)\b|\bgotea\b|\bhay una fuga\b/,
  },
  next_step: {
    en: /\b(so|okay so|ok so|then|alright so|all right so),? (i|we) ?('ll| will|'m going to| come| bring| call| go| pick| return| be| wait| take| fill| sign| pay| send| drop)\b|\bi('ll| will| am going to|'m going to| can) (come|be|bring|call|go|pick|return|see|drop|send|fill|sign|pay|wait|take|stop)\b|\bi (come|get) back\b|\byou('ll| will) (call|text|email|let me know|contact|send)\b|\bsee you (on|at|tomorrow|then|next|in|soon)\b|\b(i|we)'?ll be back\b/,
    es: /\b(entonces|bueno|o sea|ok|okay|listo),? (yo )?(regreso|vuelvo|traigo|llamo|vengo|paso|recojo|voy|espero|firmo|pago|mando|envio|le (llamo|traigo|mando)|me (quedo|espero))\b|\b(regreso|vuelvo|traigo|llamo|vengo|paso|recojo|voy a (regresar|volver|traer|llamar|venir|pasar|recoger|firmar|pagar|mandar|esperar)) (el|la|los|las|manana|hoy|a las|a la|despues|mas tarde|en|esta|este|por|con|aqui|antes)\b|\b(manana|hoy|esta tarde|esta semana|despues|mas tarde|el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)),? (regreso|vuelvo|traigo|llamo|vengo|paso|recojo|voy)\b|\bme (llaman?|avisan?|mandan?|escriben?) cuando\b|\bnos vemos\b|\bhasta (el|manana|luego|pronto|entonces|la)\b|\bquedamos (en|asi|para)\b/,
  },
}

// Confirming by asking: the words that turn a detail into a check.
const CHECK: Record<Lang, RegExp> = {
  en: /\b(right|correct)\?|\bis that (right|correct)\b|\bdid you say\b|\byou said\b|\blet me (make sure|check|confirm|get this right)\b|\bjust to (confirm|be sure|check|make sure)\b|\bto confirm\b|\bso that'?s\b|\bso it'?s\b|\b(could|can|would) you spell\b|\bspell (that|it|the name|your name)\b|\bhow do you spell\b/,
  es: /\bverdad\?|\bcierto\?|[,¿] ?no\?|\besta bien\?|\b(usted )?dijo\b.*\?|\bpara (confirmar|estar segur[oa]|asegurarme)\b|\ba ver si (entendi|entiendo)\b|\bentonces,? (es|son|el|la|los|las|a las|a la|hoy|manana)\b|\bme (lo )?deletrea\b|\bpuede deletrear\b|\bcomo se escribe\b|\bo sea\b|\bentendi bien\b/,
}

// Confirming by echo: the learner says a detail from the partner's line back,
// as a question or after "so" / "entonces". These are the details worth echoing.
const NUMBER_WORDS = [
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand',
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'thirtieth',
  'noon', 'midnight',
  'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'mil', 'media', 'cuarto', 'mediodia',
]
const DAY_WORDS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const ECHOABLE = new Set([...NUMBER_WORDS, ...DAY_WORDS])
/** Capitalized words that are not names. */
const NOT_NAMES = new Set(['dr', 'dra', 'mr', 'mrs', 'ms', 'sr', 'sra', 'srta', 'english', 'spanish', 'ingles', 'espanol', 'charla', 'id', 'real'])

/** The details in a partner line a learner might say back: numbers, times, days, months, names. */
export function echoTokens(partner: string): string[] {
  const out = new Set<string>()
  for (const m of partner.matchAll(/\d+(?::\d+)?/g)) {
    out.add(m[0])
    if (m[0].includes(':')) out.add(m[0].split(':')[0])
  }
  for (const w of fold(partner).split(/[^a-z0-9]+/)) if (ECHOABLE.has(w)) out.add(w)
  // Names: a capitalized word that does not open a sentence. "Dr." is a title, not a sentence end.
  const text = partner.replace(/\b(Dr|Dra|Mr|Mrs|Ms|Sr|Sra|Srta|St)\./g, '$1')
  for (const sentence of text.split(/(?<=[.!?¿¡])\s+/)) {
    const ws = sentence.trim().split(/\s+/)
    for (const w of ws.slice(1)) {
      const m = /^[(«"']?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})/.exec(w)
      if (m && !NOT_NAMES.has(fold(m[1]))) out.add(fold(m[1]))
    }
  }
  return [...out]
}

const OPENER = /^[¿¡]?\s*(so|okay|ok|entonces|o sea|bueno|a ver)\b/

function isQuestion(text: string): boolean {
  return /\?/.test(text) || /^\s*¿/.test(text)
}

function confirms(text: string, lang: Lang, ctx?: TurnContext): boolean {
  const f = fold(text)
  if (CHECK[lang].test(f)) return true
  // A check in the other language's words is that language's confirmation, not this one's.
  if (CHECK[lang === 'en' ? 'es' : 'en'].test(f)) return false
  if (!ctx?.prevPartner) return false
  if (!(isQuestion(text) || OPENER.test(f))) return false
  // The echo itself is in whatever language the partner spoke; the surrounding words say which.
  if (!looksLike(lang, text)) return false
  return echoTokens(ctx.prevPartner).some((tok) => hasWords(text, tok))
}

/** The skills this turn used in one language. Order: the worded skills, then confirm, then follow-up. */
export function detectIn(text: string, lang: Lang, ctx?: TurnContext): SkillId[] {
  const f = fold(text)
  if (!f) return []
  const out: SkillId[] = []
  for (const id of Object.keys(PATTERNS) as Worded[]) if (PATTERNS[id][lang].test(f)) out.push(id)
  if (confirms(text, lang, ctx)) out.push('confirm')
  // A real question, after the partner has said something, that is not one of the asks above.
  if (out.length === 0 && ctx?.prevPartner && isQuestion(text) && words(text) >= 2 && looksLike(lang, text)) out.push('follow_up')
  return out
}

/** The skills this turn used in either language: a learner reaching for help in their own language still used the skill. */
export function detectSkills(text: string, ctx?: TurnContext): SkillId[] {
  const out: SkillId[] = []
  for (const lang of ['en', 'es'] as Lang[]) for (const id of detectIn(text, lang, ctx)) if (!out.includes(id)) out.push(id)
  return out
}

/** Was this turn a request for help understanding the previous line, in either language? */
export function asksForHelp(text: string): boolean {
  return detectSkills(text).some((s) => CLARIFYING.has(s))
}

/**
 * The rule-based hits, plus the model's one vote when it can be trusted. The
 * vote is a supplement, never the judge: it counts only when the rules found
 * nothing, it has to name one of the eight skills, and it has to fit the shape
 * of the line. On the free model the vote is right about half the time
 * ("follow_up" for a first greeting, "confirm" for a plain answer), so a
 * follow-up or a confirmation still needs a question (or "so…") after a
 * partner line, and any other skill needs more than two words to vote on.
 */
export function withModelSkill(hits: SkillId[], model: unknown, text = '', ctx?: TurnContext): SkillId[] {
  if (hits.length > 0 || !isSkillId(model)) return hits
  if (model === 'follow_up' || model === 'confirm') {
    if (!ctx?.prevPartner || !(isQuestion(text) || OPENER.test(fold(text)))) return hits
  } else if (words(text) < 3) {
    return hits
  }
  return [model]
}

export type Verdict = 'hit' | 'other_lang' | 'miss'

/**
 * The drill's judgment: the skill in the language being practiced is a hit;
 * the skill in the learner's own language is close, and the feedback says so;
 * anything else is a miss, and the feedback shows the phrases.
 */
export function judgeDrill(text: string, skill: SkillId, lang: Lang, cue: string): Verdict {
  const ctx = { prevPartner: cue }
  if (detectIn(text, lang, ctx).includes(skill)) return 'hit'
  if (detectIn(text, lang === 'en' ? 'es' : 'en', ctx).includes(skill)) return 'other_lang'
  return 'miss'
}
