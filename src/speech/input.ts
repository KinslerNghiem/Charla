import type { Lang } from '../i18n/strings'
import { transcribe } from '../tutor/client'

// Tap to talk, three tiers, chosen at runtime, in this order:
//   recorder  raw microphone samples captured through the Web Audio API,
//             encoded as a 16 kHz mono WAV in the app, posted to /api/stt
//             (Workers AI Whisper) and discarded. WAV on purpose: iPhones
//             record MediaRecorder clips as AAC-in-MP4, which the
//             transcription model rejected on the live site, while a WAV
//             built here is the same bytes on every browser and always
//             accepted. The same samples feed the level meter that shows the
//             learner the phone is hearing them.
//   browser   SpeechRecognition, only where the Web Audio API is missing.
//   typed     always available.
// The mic is open only between the two taps, and the clip never touches disk.

export type Tier = 'recorder' | 'browser' | 'typed'

const MAX_CLIP_MS = 20_000
const TARGET_RATE = 16_000
const SILENCE_PEAK = 0.04
const SILENCE_MS = 1_300
const MIN_SPEECH_MS = 500

// Safari only ships the prefixed constructor, so look both up loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtor = new () => any

function speechRecognitionCtor(): AnyCtor | null {
  const w = window as unknown as { SpeechRecognition?: AnyCtor; webkitSpeechRecognition?: AnyCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function audioContextCtor(): typeof AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function isStandalone(): boolean {
  return (
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'typed'
  if (typeof navigator.mediaDevices?.getUserMedia === 'function' && audioContextCtor()) return 'recorder'
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

/** Linear downsample of mono float samples to `outRate`. */
export function downsample(chunks: Float32Array[], inRate: number, outRate: number): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const all = new Float32Array(total)
  let off = 0
  for (const c of chunks) {
    all.set(c, off)
    off += c.length
  }
  if (inRate === outRate) return all
  const ratio = inRate / outRate
  const out = new Float32Array(Math.floor(all.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const a = Math.floor(pos)
    const b = Math.min(a + 1, all.length - 1)
    const frac = pos - a
    out[i] = all[a] * (1 - frac) + all[b] * frac
  }
  return out
}

/** 16-bit PCM WAV, mono. Forty-four bytes of header, then the samples. */
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(o, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

export function startRecorderListener(lang: Lang, opts: ListenOptions = {}): Listener {
  const AC = audioContextCtor()
  if (!AC) throw new Error('Web Audio unavailable')
  // Created synchronously, inside the tap, or iOS leaves it suspended.
  const ctx = new AC()
  const chunks: Float32Array[] = []
  let peak = 0
  let lastLevel = 0
  let stopFn = () => {}
  let stopped = false

  const result = new Promise<string>((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then(async (stream) => {
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return resolve('')
        }
        try {
          await ctx.resume()
        } catch {}
        const src = ctx.createMediaStreamSource(stream)
        // ScriptProcessorNode is old but it is the one capture path that works
        // in every browser that matters here, the installed iOS app included.
        const proc = ctx.createScriptProcessor(4096, 1, 1)
        // Some browsers only run the processor when it reaches the output, so
        // route it through silence rather than into the speaker (feedback).
        const mute = ctx.createGain()
        mute.gain.value = 0
        // Auto-stop: once the learner has said something, a pause of
        // SILENCE_MS ends the clip, so one tap is the whole gesture. The
        // button still stops it early, and MAX_CLIP_MS is the ceiling.
        let spokeAt = 0
        let lastLoud = 0
        proc.onaudioprocess = (e) => {
          const d = e.inputBuffer.getChannelData(0)
          chunks.push(new Float32Array(d))
          let sum = 0
          for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
          const lvl = Math.min(1, Math.sqrt(sum / d.length) * 4)
          if (lvl > peak) peak = lvl
          const now = performance.now()
          if (lvl > SILENCE_PEAK) {
            if (!spokeAt) spokeAt = now
            lastLoud = now
          } else if (spokeAt && now - spokeAt > MIN_SPEECH_MS && now - lastLoud > SILENCE_MS) {
            stopFn()
          }
          if (now - lastLevel > 80) {
            lastLevel = now
            opts.onLevel?.(lvl)
          }
        }
        src.connect(proc)
        proc.connect(mute)
        mute.connect(ctx.destination)
        opts.onOpen?.()

        const timer = setTimeout(() => stopFn(), MAX_CLIP_MS)
        stopFn = async () => {
          if (stopped) return
          stopped = true
          clearTimeout(timer)
          try {
            proc.disconnect()
            src.disconnect()
            mute.disconnect()
          } catch {}
          stream.getTracks().forEach((t) => t.stop())
          const rate = ctx.sampleRate
          ctx.close().catch(() => {})
          opts.onLevel?.(0)
          const seconds = chunks.reduce((n, c) => n + c.length, 0) / rate
          // A tap, or silence: nothing to send. Whisper, given silence, likes
          // to answer "Thank you.", so silence is decided here, not there.
          if (seconds < 0.4 || peak < SILENCE_PEAK) return resolve('')
          opts.onWorking?.()
          try {
            const wav = encodeWav(downsample(chunks, rate, TARGET_RATE), TARGET_RATE)
            resolve((await transcribe(wav, lang)).trim())
          } catch (err) {
            reject(err)
          }
        }
      })
      .catch((err) => {
        ctx.close().catch(() => {})
        reject(err)
      })
  })
  return {
    result,
    stop: () => {
      if (!stopped && chunks.length === 0) stopped = true // stopped before the mic opened
      stopFn()
    },
  }
}

export function startListener(tier: Tier, lang: Lang, opts: ListenOptions = {}): Listener | null {
  if (tier === 'recorder') return startRecorderListener(lang, opts)
  if (tier === 'browser') return startBrowserListener(lang, opts)
  return null
}
