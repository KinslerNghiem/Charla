import { useEffect, useState } from 'preact/hooks'
import { get, set } from '../storage'
import { STRINGS, type Lang, type StringKey } from './strings'

// One question sets everything: "which language do you speak?" (LangPick).
// native() is the answer. The interface, the tips and the glosses are in it;
// the partner speaks the other one, learning(). There is no separate interface
// switch: two independent switches confused every tester.
//
// `lang` is the stored interface language. It equals native() once the learner
// has answered; before that it is a guess from the browser so the first screen
// and the birth gate already read right.

const guess: Lang =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'

let current: Lang = get<Lang>('lang', guess)

// index.html ships lang="es". Without this a returning English speaker gets a
// Spanish document (screen readers, hyphenation, autocorrect) on every reload,
// because setLang() only runs when the answer changes.
if (typeof document !== 'undefined') document.documentElement.lang = current

export function lang(): Lang {
  return current
}

export function setLang(l: Lang): void {
  current = l
  set('lang', l)
  if (typeof document !== 'undefined') document.documentElement.lang = l
  dispatchEvent(new Event('charla:lang'))
}

export function t(key: StringKey): string {
  return STRINGS[current][key] ?? STRINGS.en[key]
}

/** A string in a specific language, regardless of the interface language. */
export function tIn(l: Lang, key: StringKey): string {
  return STRINGS[l][key] ?? STRINGS.en[key]
}

/** The language the learner is practicing: the partner speaks it. */
export function learning(): Lang {
  return get<Lang>('learning', 'en')
}

/** Has the learner answered "which language do you speak?" yet. */
export function hasNative(): boolean {
  return get<Lang | null>('native', null) !== null
}

/** One answer sets both: the interface speaks `l`, the partner speaks the other. */
export function setNative(l: Lang): void {
  set('native', l)
  set('learning', l === 'es' ? 'en' : 'es')
  setLang(l)
}

export function clearNative(): void {
  set('native', null)
  dispatchEvent(new Event('charla:lang'))
}

/** The learner's own language: where tips and translations go. */
export function native(): Lang {
  return learning() === 'en' ? 'es' : 'en'
}

// Re-render a component when the language answer changes.
export function useLangTick(): void {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    addEventListener('charla:lang', on)
    return () => removeEventListener('charla:lang', on)
  }, [])
}
