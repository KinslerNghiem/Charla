import { useEffect, useState } from 'preact/hooks'
import { get, set } from '../storage'
import { STRINGS, type Lang, type StringKey } from './strings'

// Two settings, kept apart:
//
//   lang()      the interface language: every label, button and notice.
//   learning()  the direction: the language the partner speaks and the learner
//               practices. native() is its other side, where tips and glosses go.
//
// The first screen asks one question, "which language do you speak?", and
// setNative() answers both from it: interface in that language, partner in the
// other. After that the two move on their own. The header chip switches the
// interface in place (setLang), and the scene picker switches the direction
// (setLearning). Neither clears anything else, so a conversation in progress
// survives a change of interface language, and a Spanish speaker who wants the
// app in English for the immersion still gets tips and glosses in Spanish.
//
// Both settings live in localStorage under the charla. prefix, like everything
// else: two words, no account, and "Clear everything" removes them.
//
// `lang` starts as a guess from the browser so the first screen and the birth
// gate already read right before the question is answered.

const guess: Lang =
  typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'

let current: Lang = get<Lang>('lang', guess)

// index.html ships lang="es". Without this a returning English speaker gets a
// Spanish document (screen readers, hyphenation, autocorrect) on every reload,
// because setLang() only runs when the answer changes.
if (typeof document !== 'undefined') document.documentElement.lang = current

// Components that show either setting re-render on this event (useLangTick).
function announce(): void {
  if (typeof dispatchEvent === 'function') dispatchEvent(new Event('charla:lang'))
}

export function other(l: Lang): Lang {
  return l === 'es' ? 'en' : 'es'
}

export function lang(): Lang {
  return current
}

/** The interface language. Changes nothing else: not the direction, not progress. */
export function setLang(l: Lang): void {
  current = l
  set('lang', l)
  if (typeof document !== 'undefined') document.documentElement.lang = l
  announce()
}

/** Flip the interface language in place. */
export function toggleLang(): void {
  setLang(other(current))
}

/**
 * The last resort for a string nobody wrote: readable words, never a raw key.
 * Both tables are typed and tests/strings.test.ts enforces key parity, so this
 * only ever runs for a dynamic key such as `type_${venue.type}` when the venue
 * file gains a type before strings.ts does.
 */
export function humanize(key: string): string {
  const words = key.replace(/^(type|badge|group|nav|kids|table|about|coach|talk|gate|step|level|direction|lang_name)_/, '').replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function t(key: StringKey): string {
  return tIn(current, key)
}

/** A string in a specific language, regardless of the interface language. */
export function tIn(l: Lang, key: StringKey): string {
  return STRINGS[l][key] ?? STRINGS.en[key] ?? humanize(key)
}

/** The language the learner is practicing: the partner speaks it. */
export function learning(): Lang {
  return get<Lang>('learning', 'en')
}

/** Switch the direction. The interface language stays as it is. */
export function setLearning(l: Lang): void {
  set('learning', l)
  announce()
}

/** The learner's own language: where tips and translations go. */
export function native(): Lang {
  return other(learning())
}

/** Has the learner answered "which language do you speak?" yet. */
export function hasNative(): boolean {
  return get<Lang | null>('native', null) !== null
}

/** The first screen's answer sets both: the interface speaks `l`, the partner speaks the other. */
export function setNative(l: Lang): void {
  set('native', l)
  set('learning', other(l))
  setLang(l)
}

/** Forget the answer, so the first screen asks again. Kid mode's grown-ups panel uses this. */
export function clearNative(): void {
  set('native', null)
  announce()
}

// Re-render a component when either setting changes.
export function useLangTick(): void {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    addEventListener('charla:lang', on)
    return () => removeEventListener('charla:lang', on)
  }, [])
}
