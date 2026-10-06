import type { Lang } from '../i18n/strings'
import { fetchSpeech } from '../tutor/client'
import { hush as hushDevice, speak, unlock as unlockDevice } from './output'

// The partner's voice for teens and adults: a neural voice from the Worker
// (/api/tts), played through one <audio> element, with the device's own voice
// as the fallback when there is no connection, the day's allowance is spent,
// or the browser refuses to play.
//
// Kid mode never imports this file. Charlita speaks through output.ts alone,
// which talks to nothing but the phone; tests/ninos-offline.test.ts would fail
// the build if this module (it imports the API client) reached the kid path.

export type Spoke = 'neural' | 'device' | 'none' | 'superseded'

const CACHE_MAX = 24
/** After the Worker says no (cap, model down), stop asking for a while and use the device voice. */
const BACKOFF_MS = 2 * 60 * 1000

let el: HTMLAudioElement | null = null
let primed = false
let seq = 0
let onDone: (() => void) | null = null
let remoteDownUntil = 0
// Clips already fetched this session, so replaying a line is instant and free.
const clips = new Map<string, string>()

function finish(): void {
  const f = onDone
  onDone = null
  f?.()
}

function player(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
    el.addEventListener('ended', finish)
    el.addEventListener('error', finish)
  }
  return el
}

/** Forty-four bytes of header and a twentieth of a second of nothing. */
function silence(): string {
  const samples = 400
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true)
  v.setUint32(28, 16000, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples * 2, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

/**
 * Call from a tap. Phones only let a page start audio from a user gesture, and
 * the reply arrives seconds after the tap that asked for it; playing a moment
 * of silence now is what lets this same element speak later.
 */
export function unlockVoice(): void {
  unlockDevice()
  const a = player()
  if (!a || primed) return
  primed = true
  try {
    a.src = silence()
    void a.play().catch(() => {})
  } catch {}
}

function remember(key: string, url: string): void {
  clips.set(key, url)
  if (clips.size > CACHE_MAX) {
    const oldest = clips.keys().next().value
    if (oldest !== undefined) {
      const old = clips.get(oldest)
      if (old) URL.revokeObjectURL(old)
      clips.delete(oldest)
    }
  }
}

/** Stop whatever is speaking. Called before the mic opens, so the clip does not contain our own voice. */
export function hushVoice(): void {
  seq++
  hushDevice()
  if (el && !el.paused) el.pause()
  finish()
}

/**
 * Says the line. Resolves once speech has started (or could not): 'neural' for
 * the Worker's voice, 'device' for the phone's own, 'none' when nothing will be
 * heard, 'superseded' when a newer line or a hush overtook this one.
 */
export async function say(text: string, lang: Lang, opts: { rate?: number; onEnd?: () => void } = {}): Promise<Spoke> {
  if (!text) return 'none'
  hushVoice()
  const mine = ++seq
  onDone = opts.onEnd ?? null
  const rate = opts.rate ?? 1
  const a = player()
  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  if (a && online && Date.now() > remoteDownUntil) {
    try {
      const key = lang + '|' + text
      let url = clips.get(key)
      if (!url) {
        url = URL.createObjectURL(await fetchSpeech(text, lang))
        remember(key, url)
      }
      if (mine !== seq) return 'superseded'
      a.src = url
      // A new source resets playbackRate to the default, so set both.
      a.defaultPlaybackRate = rate
      a.playbackRate = rate
      await a.play()
      return mine === seq ? 'neural' : 'superseded'
    } catch (err) {
      if (mine !== seq) return 'superseded'
      const status = (err as { status?: number })?.status
      if (status === 429 || status === 503) remoteDownUntil = Date.now() + BACKOFF_MS
      // Anything else (no connection, a timeout, autoplay refused) just falls through.
    }
  }
  if (mine !== seq) return 'superseded'
  if (speak(text, lang, rate, finish)) return 'device'
  finish()
  return 'none'
}
