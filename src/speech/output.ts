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
// Android is the exception to the localService rule. Chrome there hands the
// text to the system text-to-speech engine and reports every voice as
// non-local, so the filter left Android with no voice at all: Listen did
// nothing on most of the phones this app is for. The system engine is the
// phone's own voice, which is exactly what the rule is trying to keep.
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

function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/** Which voices may read a line, given the full list. Exported for tests. */
export function usableVoices<V extends { name: string; localService?: boolean }>(all: V[], android: boolean): V[] {
  return all.filter((v) => !NOVELTY.test(v.name) && (android || v.localService !== false))
}

/** On-device voices only. A remote voice would send the text off the phone. */
export function localVoices(): SpeechSynthesisVoice[] {
  if (!available()) return []
  return usableVoices(speechSynthesis.getVoices(), isAndroid())
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
// Chrome on Android swallows an utterance queued in the same tick as a
// cancel(). hush() records when it cancelled, and say() waits this long after
// one before speaking; `gen` lets a hush in that gap drop the pending line.
const CANCEL_SETTLE_MS = 80
let cancelledAt = 0
let gen = 0

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
    // A space at zero volume, not an empty string: Safari drops an empty
    // utterance without counting it as the gesture that unlocks speech.
    const prime = new SpeechSynthesisUtterance(' ')
    prime.volume = 0
    speechSynthesis.speak(prime)
    unlocked = true
  } catch {}
}

/** Stop whatever is being read. Called before the mic opens, so the clip does not contain our own voice. */
export function hush(): void {
  if (!available()) return
  gen++
  cancelledAt = Date.now()
  try {
    speechSynthesis.cancel()
  } catch {}
}

function say(text: string, lang: Lang, rate: number, voice: SpeechSynthesisVoice, onEnd?: () => void): void {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === 'es' ? 'es-US' : 'en-US'
  u.voice = voice
  u.rate = rate
  if (onEnd) {
    u.onend = onEnd
    u.onerror = onEnd
  }
  // When something is being read, or hush() just ran (voice.ts silences the
  // previous line right before handing this one over), stop it and speak a
  // beat later; see CANCEL_SETTLE_MS. A hush inside that beat wins.
  if (speechSynthesis.speaking || speechSynthesis.pending || Date.now() - cancelledAt < CANCEL_SETTLE_MS) {
    speechSynthesis.cancel()
    cancelledAt = Date.now()
    const mine = ++gen
    setTimeout(() => {
      if (mine === gen) speechSynthesis.speak(u)
    }, CANCEL_SETTLE_MS)
  } else {
    speechSynthesis.speak(u)
  }
}

/**
 * Reads the line aloud. Returns false when nothing will be heard, so the UI
 * can say so: a laptop with no Spanish voice pack is common, and a silent
 * Listen button looks broken.
 */
export function speak(text: string, lang: Lang, rate = 1, onEnd?: () => void): boolean {
  if (!available() || !text) return false
  const voice = pickVoice(lang)
  if (voice) {
    say(text, lang, rate, voice, onEnd)
    return true
  }
  // No local voice, no speaking. Letting the platform choose could hand the
  // phrase to a network synthesizer. One exception: an empty list usually means
  // Chrome has not loaded the voices yet, so wait for them once and try again.
  if (speechSynthesis.getVoices().length === 0 && typeof speechSynthesis.addEventListener === 'function') {
    speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        const late = pickVoice(lang)
        if (late) say(text, lang, rate, late, onEnd)
        else onEnd?.()
      },
      { once: true },
    )
    return true
  }
  return false
}
