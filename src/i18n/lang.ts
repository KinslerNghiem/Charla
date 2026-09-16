import { useEffect, useState } from 'preact/hooks'
import { get, set } from '../storage'
import { STRINGS, type Lang, type StringKey } from './strings'

// Two independent switches:
//   lang()     = the language of the interface (buttons, labels)
//   learning() = the language the learner is practicing (the partner speaks it)
// native() is the other one, where tips and translations go.

const guess: Lang =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'

let current: Lang = get<Lang>('lang', guess)

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

export function learning(): Lang {
  return get<Lang>('learning', 'en')
}

export function setLearning(l: Lang): void {
  set('learning', l)
  dispatchEvent(new Event('charla:lang'))
}

export function native(): Lang {
  return learning() === 'en' ? 'es' : 'en'
}

// Re-render a component when either switch changes.
export function useLangTick(): void {
  const [, force] = useState(0)
  useEffect(() => {
    const on = () => force((n) => n + 1)
    addEventListener('charla:lang', on)
    return () => removeEventListener('charla:lang', on)
  }, [])
}
