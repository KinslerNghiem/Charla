import type { Lang } from '../i18n/strings'
import { transcribe } from '../tutor/client'

// Tap to talk, three tiers, chosen at runtime, in this order:
//   recorder  MediaRecorder clip posted to /api/stt (Workers AI Whisper) and
//             discarded. The default wherever a microphone can be opened,
//             because it behaves the same in a Safari tab, the installed iOS
//             app, Chrome and Firefox, and because the same stream feeds the
//             level meter that shows the learner the phone is hearing them.
//   browser   SpeechRecognition, only where MediaRecorder is missing.
//   typed     always available.
// The mic is open only between the two taps, and the clip never touches disk.

export type Tier = 'recorder' | 'browser' | 'typed'

const MAX_CLIP_MS = 20_000

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
  if (typeof navigator.mediaDevices?.getUserMedia === 'function' && 'MediaRecorder' in window) return 'recorder'
  if (speechRecognitionCtor()) return 'browser'
  return 'typed'
}

export type TalkError = 'denied' | 'unavailable' | 'failed'

export interface Listener {
  /** Resolves with the transcript ("" if nothing was understood) after stop(). */
  result: Promise<string>
  stop: () => void
}

export interface ListenOptions {
  /** Called ~12 times a second with the input level, 0..1, while recording. */
  onLevel?: (level: number) => void
  /** Called once the mic is actually open, so the UI can say "speak now". */
  onOpen?: () => void
  /** Called when the clip has been sent and we are waiting for the transcript. */
  onWorking?: () => void
}

function bcp47(lang: Lang): string {
  return lang === 'es' ? 'es-US' : 'en-US'
}

export function classify(err: unknown): TalkError {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return 'unavailable'
  if ((err as { status?: number })?.status === 503) return 'unavailable'
  return 'failed'
}

export function startBrowserListener(lang: Lang, opts: ListenOptions = {}): Listener {
  const Ctor = speechRecognitionCtor()
  if (!Ctor) throw new Error('SpeechRecognition unavailable')
  const rec = new Ctor()
  rec.lang = bcp47(lang)
  rec.continuous = false
  rec.interimResults = false
  rec.maxAlternatives = 1
  let text = ''
  const result = new Promise<string>((resolve, reject) => {
    rec.onstart = () => opts.onOpen?.()
    rec.onresult = (e: any) => {
      text = e.results?.[0]?.[0]?.transcript ?? ''
    }
    rec.onerror = (e: any) =>
      reject(Object.assign(new Error(e.error ?? 'speech error'), { name: e.error === 'not-allowed' ? 'NotAllowedError' : 'Error' }))
    rec.onend = () => resolve(text.trim())
  })
  rec.start()
  return { result, stop: () => rec.stop() }
}

// Picks a container the browser can actually produce. iOS Safari records
// audio/mp4; Chrome and Firefox record webm/opus. Whisper reads both.
function pickMime(): string | undefined {
  const MR = (window as unknown as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((t) => MR?.isTypeSupported?.(t))
}

export function startRecorderListener(lang: Lang, opts: ListenOptions = {}): Listener {
  let recorder: MediaRecorder | null = null
  let stopFn = () => {}
  const chunks: BlobPart[] = []
  const result = new Promise<string>((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mime = pickMime()
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)

        // The meter. An AnalyserNode on the same stream; RMS of one frame,
        // scaled so ordinary speech fills about half the bar.
        let ctx: AudioContext | null = null
        let raf = 0
        // Whisper, given silence, likes to answer "Thank you." A clip whose
        // level never rose above the noise floor is treated as nothing said.
        let peak = 0
        try {
          const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
          const AC = w.AudioContext ?? w.webkitAudioContext
          if (AC) {
            ctx = new AC()
            const src = ctx.createMediaStreamSource(stream)
            const an = ctx.createAnalyser()
            an.fftSize = 512
            src.connect(an)
            const buf = new Uint8Array(an.fftSize)
            let last = 0
            const tick = (now: number) => {
              if (now - last > 80) {
                last = now
                an.getByteTimeDomainData(buf)
                let sum = 0
                for (let i = 0; i < buf.length; i++) {
                  const v = (buf[i] - 128) / 128
                  sum += v * v
                }
                const lvl = Math.min(1, Math.sqrt(sum / buf.length) * 4)
                if (lvl > peak) peak = lvl
                opts.onLevel?.(lvl)
              }
              raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
          }
        } catch {
          // No meter is not no microphone.
        }

        const cleanup = () => {
          cancelAnimationFrame(raf)
          stream.getTracks().forEach((t) => t.stop())
          ctx?.close().catch(() => {})
          opts.onLevel?.(0)
        }

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.onerror = () => {
          cleanup()
          reject(new Error('recorder error'))
        }
        recorder.onstop = async () => {
          cleanup()
          const blob = new Blob(chunks, { type: recorder?.mimeType || mime || 'application/octet-stream' })
          if (blob.size < 1000) return resolve('') // a tap, not speech
          if (ctx && peak < 0.04) return resolve('') // silence; do not ask Whisper
          opts.onWorking?.()
          try {
            resolve((await transcribe(blob, lang)).trim())
          } catch (err) {
            reject(err)
          }
        }
        recorder.start()
        opts.onOpen?.()
        const timer = setTimeout(() => stopFn(), MAX_CLIP_MS)
        stopFn = () => {
          clearTimeout(timer)
          if (recorder?.state === 'recording') recorder.stop()
        }
      })
      .catch(reject)
  })
  return { result, stop: () => stopFn() }
}

export function startListener(tier: Tier, lang: Lang, opts: ListenOptions = {}): Listener | null {
  if (tier === 'recorder') return startRecorderListener(lang, opts)
  if (tier === 'browser') return startBrowserListener(lang, opts)
  return null
}
