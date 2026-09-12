import type { Lang } from '../i18n/strings'

// Push-to-talk, four tiers, chosen at runtime, in this order:
//   native   a Capacitor speech plugin, if the app is ever wrapped (not in v1)
//   browser  SpeechRecognition in a Safari or Chrome *tab*
//   recorder MediaRecorder clip posted to /api/stt when running as an installed
//            iOS web app, where Apple's SpeechRecognition silently does nothing
//   typed    always available; the demo's default path
// The mic is live only while the button is held, which is also the privacy story.

export type Tier = 'native' | 'browser' | 'recorder' | 'typed'

// Safari only ships the prefixed constructor, so look both up loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtor = new () => any

function speechRecognitionCtor(): AnyCtor | null {
  const w = window as unknown as { SpeechRecognition?: AnyCtor; webkitSpeechRecognition?: AnyCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isStandalone(): boolean {
  return (
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'typed'
  const standalone = isStandalone()
  if (speechRecognitionCtor() && !standalone) return 'browser'
  if (standalone && typeof navigator.mediaDevices?.getUserMedia === 'function' && 'MediaRecorder' in window) return 'recorder'
  return 'typed'
}

export interface Listener {
  /** Resolves with the transcript when stop() is called or the utterance ends. */
  result: Promise<string>
  stop: () => void
}

function bcp47(lang: Lang): string {
  return lang === 'es' ? 'es-US' : 'en-US'
}

export function startBrowserListener(lang: Lang): Listener {
  const Ctor = speechRecognitionCtor()
  if (!Ctor) throw new Error('SpeechRecognition unavailable')
  const rec = new Ctor()
  rec.lang = bcp47(lang)
  rec.continuous = false
  rec.interimResults = false
  rec.maxAlternatives = 1
  let text = ''
  const result = new Promise<string>((resolve, reject) => {
    rec.onresult = (e: any) => {
      text = e.results?.[0]?.[0]?.transcript ?? ''
    }
    rec.onerror = (e: any) => reject(new Error(e.error ?? 'speech error'))
    rec.onend = () => resolve(text.trim())
  })
  rec.start()
  return { result, stop: () => rec.stop() }
}

export function startRecorderListener(_lang: Lang): Listener {
  let recorder: MediaRecorder | null = null
  const chunks: BlobPart[] = []
  let stopFn = () => {}
  const result = new Promise<string>((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => chunks.push(e.data)
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/mp4' })
          try {
            const res = await fetch('/api/stt', { method: 'POST', body: blob })
            if (!res.ok) throw new Error(`stt ${res.status}`)
            const json = (await res.json()) as { text: string }
            resolve(json.text ?? '')
          } catch (err) {
            reject(err)
          }
        }
        recorder.start()
        stopFn = () => recorder?.state === 'recording' && recorder.stop()
      })
      .catch(reject)
  })
  return { result, stop: () => stopFn() }
}

export function startListener(tier: Tier, lang: Lang): Listener | null {
  if (tier === 'browser') return startBrowserListener(lang)
  if (tier === 'recorder') return startRecorderListener(lang)
  return null
}
