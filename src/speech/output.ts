import type { Lang } from '../i18n/strings'

// The partner's voice, from the device itself.
//
// Two filters, both load-bearing. Novelty voices (Apple ships a set of them for
// es-MX and es-ES) would read a pharmacy line in a cartoon voice. And
// localService === false means the browser sends the text to a remote
// synthesizer: Chrome's "Google español de Estados Unidos" is one, and it would
// match es-US first. Kid mode uses this file and promises that nothing leaves
// the device, so a remote voice is not an option there or anywhere else.
//
// On iOS the first speak() must come from a tap; unlock() handles that, and
// every Listen button is a tap anyway.

const NOVELTY =
  /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Albert|Bad News|Fred|Junior|Kathy|Ralph)\b/i

const CHAIN: Record<Lang, string[]> = {
  es: ['es-US', 'es-MX', 'es-419', 'es-ES', 'es'],
  en: ['en-US', 'en'],
}

export function available(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** On-device voices only. A remote voice would send the text off the phone. */
export function localVoices(): SpeechSynthesisVoice[] {
  if (!available()) return []
  return speechSynthesis.getVoices().filter((v) => !NOVELTY.test(v.name) && v.localService !== false)
}

export function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const voices = localVoices()
  for (const tag of CHAIN[lang]) {
    const hit = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === tag.toLowerCase())
    if (hit) return hit
  }
  return voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null
}

let unlocked = false

/**
 * Call from a user gesture once, so later speak() calls work on iOS. It also
 * primes the voice list: Chrome returns an empty getVoices() on the first
 * synchronous call and fills it in later, and without a voice we stay silent
 * rather than let the platform pick a remote one.
 */
export function unlock(): void {
  if (!available() || unlocked) return
  try {
    speechSynthesis.getVoices()
    speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices(), { once: true })
    speechSynthesis.speak(new SpeechSynthesisUtterance(''))
    unlocked = true
  } catch {}
}

export function speak(text: string, lang: Lang, rate = 1): void {
  if (!available() || !text) return
  const voice = pickVoice(lang)
  // No local voice, no speaking. Letting the platform choose could hand the
  // phrase to a network synthesizer.
  if (!voice) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'es' ? 'es-US' : 'en-US'
  u.voice = voice
  u.rate = rate
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}
