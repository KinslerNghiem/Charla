import type { Lang } from '../i18n/strings'
import { transcribe } from '../tutor/client'

// Tap to talk, three tiers, chosen at runtime:
//   recorder  raw microphone samples captured through the Web Audio API,
//             encoded as a 16 kHz mono WAV in the app, posted to /api/stt
//             (Workers AI Whisper) and discarded. WAV on purpose: iPhones
//             record MediaRecorder clips as AAC-in-MP4, which the
//             transcription model rejected on the live site, while a WAV
//             built here is the same bytes on every browser and always
//             accepted. The same samples feed the level meter that shows the
//             learner the phone is hearing them. This is the tier wherever
//             getUserMedia and Web Audio exist, which is every modern browser.
//   browser   SpeechRecognition. Where the Web Audio API is missing, and also
//             for the rest of the session once /api/stt answers 503 (Whisper
//             down) on a device that has it. Not in the installed iOS app,
//             where SpeechRecognition does not work.
//   typed     always available.
// The mic is open only between the two taps, and the clip never touches disk.

export type Tier = 'recorder' | 'browser' | 'typed'

const MAX_CLIP_MS = 20_000
const TARGET_RATE = 16_000
const SILENCE_PEAK = 0.04
const SILENCE_MS = 1_300
/** Loud time the clip needs before it counts as speech: below this it is a tap, a cough or a door. */
const MIN_SPEECH_MS = 400
/** Whisper, given almost nothing, answers "Thank you."; below this much loud time we do not believe it. */
const HALLUCINATION_MAX_LOUD_MS = 800
/** Padding kept on each side of the speech when the lead-in and the silence tail are cut. */
const PAD_MS = 300
/** RMS of normal speech into a phone mic is around 0.1 to 0.25; this maps it onto a visible meter. */
const LEVEL_GAIN = 4
const METER_INTERVAL_MS = 80

const HALLUCINATION = /^(thank you|thanks for watching|gracias|subt[ií]tulos.*)[.!]?$/i

// Coaching. The mic is opened with automatic gain control off, so the level it
// reports is the level that reached it and "you are too far" means something.
// (iOS ignores that request; there the advice simply fires less often.) The
// thresholds are RMS over the loud part of the clip, 0..1.
/** Below this the words are there but thin: closer, or louder. */
const QUIET_RMS = 0.015
/** Above this the mic is being shouted into. */
const LOUD_RMS = 0.3
/** More than this share of samples pinned at full scale is audible distortion. */
const CLIP_FRACTION = 0.003
/** Sound that never reached the speech threshold but was not silence either. */
const FAINT_PEAK = 0.012
const FAINT_MS = 600
/** A clip quieter than this at its peak is boosted before it is sent, since nothing else will. */
const NORMALIZE_BELOW = 0.5
const NORMALIZE_TO = 0.9
const NORMALIZE_MAX_GAIN = 10
// Pace is syllables per second over the spoken span, not words per minute: one
// short sentence said normally runs well past 200 words a minute, and Spanish
// words are longer than English ones. A relaxed speaker makes four to five and
// a half syllables a second; Spanish runs about one faster.
const FAST_SPS: Record<Lang, number> = { en: 6, es: 7.2 }
const SLOW_SPS = 2
/** Too few syllables or too short a clip says nothing reliable about pace. */
const PACE_MIN_SYLLABLES = 6
const PACE_MIN_MS = 1200

export interface ClipStats {
  /** RMS of the loud part of the clip. */
  rms: number
  /** Share of loud samples at full scale. */
  clipped: number
  /** From the first loud moment to the last, pauses included. */
  speechMs: number
  /** There was sound, but too faint to count as speech. */
  faint?: boolean
}

export type Distance = 'closer' | 'farther' | null
export type Pace = 'slower' | 'faster' | null

/** Too far, too close, or fine. */
export function distanceAdvice(s: Pick<ClipStats, 'rms' | 'clipped' | 'faint'>): Distance {
  if (s.faint) return 'closer'
  if (s.clipped > CLIP_FRACTION || s.rms > LOUD_RMS) return 'farther'
  if (s.rms > 0 && s.rms < QUIET_RMS) return 'closer'
  return null
}

/**
 * A syllable estimate good enough to tell rushed from relaxed: one per run of
 * vowels in each word, at least one a word. English drops a silent final "e"
 * ("name", "date"); a number counts one per digit.
 */
export function syllables(text: string, lang: Lang): number {
  let n = 0
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!raw) continue
    if (/^\p{N}+$/u.test(raw)) {
      n += raw.length
      continue
    }
    let runs = (raw.match(/[aeiouyáéíóúü]+/g) ?? []).length
    if (lang === 'en' && runs > 1 && /[^aeiouyl]e$/.test(raw)) runs--
    n += Math.max(1, runs)
  }
  return n
}

/** Too fast for a counter, slow enough to speed up, or fine. */
export function paceAdvice(text: string, speechMs: number, lang: Lang): Pace {
  const count = syllables(text, lang)
  if (count < PACE_MIN_SYLLABLES || speechMs < PACE_MIN_MS) return null
  const perSecond = (count * 1000) / speechMs
  if (perSecond > FAST_SPS[lang]) return 'slower'
  if (perSecond < SLOW_SPS) return 'faster'
  return null
}

/** Scales a quiet clip up towards full scale; a healthy one comes back as it was. */
export function normalize(samples: Float32Array): Float32Array {
  let max = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    if (a > max) max = a
  }
  if (max === 0 || max >= NORMALIZE_BELOW) return samples
  const gain = Math.min(NORMALIZE_MAX_GAIN, NORMALIZE_TO / max)
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

// The subset of the Web Speech API this file uses; the lib.dom typings do not
// ship it, and Safari only has the prefixed constructor.
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
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

// Set for the session when Whisper is down and the browser can transcribe
// itself; the next tap uses SpeechRecognition instead of posting a clip.
let preferBrowser = false

/** Remembers that /api/stt is down, if this device has somewhere else to turn. Exported for tests. */
export function noteSttFailure(err: unknown, hasBrowser = typeof window !== 'undefined' && !!speechRecognitionCtor() && !isStandalone()): void {
  if ((err as { status?: number })?.status === 503 && hasBrowser) preferBrowser = true
}

export function prefersBrowser(): boolean {
  return preferBrowser
}

export type TalkError = 'denied' | 'unavailable' | 'failed' | 'capped' | 'offline'

export interface Listener {
  /** Resolves with the transcript ("" if nothing was understood) after stop(). */
  result: Promise<string>
  /** Stops the mic and sends what it heard. */
  stop: () => void
  /** Stops the mic and throws the clip away; result resolves "". For leaving the page. */
  cancel: () => void
}

export interface ListenOptions {
  /** Called ~12 times a second with the input level, 0..1, while recording. */
  onLevel?: (level: number) => void
  /** Called once the mic is actually open, so the UI can say "speak now". */
  onOpen?: () => void
  /** Called when the clip has been sent and we are waiting for the transcript. */
  onWorking?: () => void
  /** Called once per clip, when the mic closes, with how loud and how long the speech was. */
  onStats?: (stats: ClipStats) => void
  /** Called while recording when the advice about distance changes. */
  onHint?: (hint: Distance) => void
  /** Lines the scene expects ("¡Gracias!"): a transcript that is one of them is kept however short the clip. */
  expected?: string[]
}

function bcp47(lang: Lang): string {
  return lang === 'es' ? 'es-US' : 'en-US'
}

export function classify(err: unknown): TalkError {
  const name = (err as { name?: string })?.name ?? ''
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') return 'unavailable'
  // fetch() itself failing is a TypeError; our own 15 s timeout is an AbortError.
  if (name === 'TypeError' || name === 'AbortError' || err instanceof TypeError) return 'offline'
  const status = (err as { status?: number })?.status
  if (status === 429) return 'capped'
  if (status === 503) return 'unavailable'
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
  let cancelled = false
  const result = new Promise<string>((resolve, reject) => {
    rec.onstart = () => opts.onOpen?.()
    rec.onresult = (e) => {
      text = e.results?.[0]?.[0]?.transcript ?? ''
    }
    rec.onerror = (e) =>
      reject(Object.assign(new Error(e.error ?? 'speech error'), { name: e.error === 'not-allowed' ? 'NotAllowedError' : 'Error' }))
    rec.onend = () => resolve(cancelled ? '' : text.trim())
  })
  rec.start()
  return {
    result,
    stop: () => rec.stop(),
    cancel: () => {
      cancelled = true
      rec.abort()
    },
  }
}

/**
 * Downsample mono float samples to `outRate`. Output length is always
 * floor(total / ratio). A box filter (the mean of each ratio-wide window) when
 * the ratio is 2 or more, which is what 48 and 44.1 kHz mics need; plain
 * linear interpolation for anything closer, where there is nothing to average.
 */
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
  if (ratio >= 2) {
    for (let i = 0; i < out.length; i++) {
      const from = Math.floor(i * ratio)
      const to = Math.min(all.length, Math.max(from + 1, Math.floor((i + 1) * ratio)))
      let sum = 0
      for (let j = from; j < to; j++) sum += all[j]
      out[i] = sum / (to - from)
    }
    return out
  }
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const a = Math.floor(pos)
    const b = Math.min(a + 1, all.length - 1)
    const frac = pos - a
    out[i] = all[a] * (1 - frac) + all[b] * frac
  }
  return out
}

/**
 * Cuts the quiet lead-in and the silence tail that ended the clip, keeping
 * `padMs` on each side. `firstLoud`/`lastLoud` are sample offsets; a clip with
 * no loud part comes back untouched.
 */
export function trimSilence(all: Float32Array, rate: number, firstLoud: number, lastLoud: number, padMs = PAD_MS): Float32Array {
  if (lastLoud <= firstLoud) return all
  const pad = Math.round((rate * padMs) / 1000)
  return all.subarray(Math.max(0, firstLoud - pad), Math.min(all.length, lastLoud + pad))
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

/** True when a transcript is Whisper filling silence rather than something the learner said. */
export function looksHallucinated(text: string, loudMs: number): boolean {
  return loudMs < HALLUCINATION_MAX_LOUD_MS && HALLUCINATION.test(text.trim())
}

/**
 * "¡Gracias!" is the last must-use line of three kid scenes and takes about
 * half a second to say, which is inside the window where Whisper's "Thank
 * you." is not believed. A transcript that is one of the scene's own lines is
 * real, however short the clip was.
 */
export function isExpected(text: string, expected?: string[]): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  const t = norm(text)
  return t !== '' && (expected ?? []).some((e) => norm(e) === t)
}

export function startRecorderListener(lang: Lang, opts: ListenOptions = {}): Listener {
  const AC = audioContextCtor()
  if (!AC) throw new Error('Web Audio unavailable')
  // Created synchronously, inside the tap, or iOS leaves it suspended.
  const ctx = new AC()
  const chunks: Float32Array[] = []
  let peak = 0
  let loudMs = 0
  let faintMs = 0
  let lastLevel = 0
  // Running totals over the loud buffers, for the coaching.
  let loudSumSq = 0
  let loudSamples = 0
  let clippedSamples = 0
  let hint: Distance = null
  // Two flags on purpose. `cancelled` is set by the buttons and is read while
  // the mic is still being opened (getUserMedia, ctx.resume take real time);
  // `stopped` belongs to stopFn and only exists once there is a stream to stop.
  let cancelled = false
  let stopped = false
  let stopFn: (post: boolean) => void = () => {}

  const result = new Promise<string>((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } })
      .then(async (stream) => {
        const release = () => {
          stream.getTracks().forEach((t) => t.stop())
          ctx.close().catch(() => {})
        }
        if (cancelled) {
          release()
          return resolve('')
        }
        try {
          await ctx.resume()
        } catch {}
        if (cancelled) {
          release()
          return resolve('')
        }
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
        // Sample offsets of the same two moments, for trimming the clip.
        let seen = 0
        let firstLoudSample = 0
        let lastLoudSample = 0
        proc.onaudioprocess = (e) => {
          const d = e.inputBuffer.getChannelData(0)
          chunks.push(new Float32Array(d))
          let sum = 0
          let pinned = 0
          for (let i = 0; i < d.length; i++) {
            sum += d[i] * d[i]
            if (d[i] >= 0.98 || d[i] <= -0.98) pinned++
          }
          const lvl = Math.min(1, Math.sqrt(sum / d.length) * LEVEL_GAIN)
          if (lvl > peak) peak = lvl
          const now = performance.now()
          const bufferMs = (d.length * 1000) / ctx.sampleRate
          if (lvl > SILENCE_PEAK) {
            if (!spokeAt) {
              spokeAt = now
              firstLoudSample = seen
            }
            lastLoud = now
            lastLoudSample = seen + d.length
            loudMs += bufferMs
            loudSumSq += sum
            loudSamples += d.length
            clippedSamples += pinned
          } else {
            if (lvl > FAINT_PEAK) faintMs += bufferMs
            if (spokeAt && now - spokeAt > MIN_SPEECH_MS && now - lastLoud > SILENCE_MS) stopFn(true)
          }
          seen += d.length
          if (now - lastLevel > METER_INTERVAL_MS) {
            lastLevel = now
            opts.onLevel?.(lvl)
            // Advice while the learner is still talking, once there is enough
            // speech to judge and only when it changes.
            const next: Distance =
              loudMs >= FAINT_MS
                ? distanceAdvice({ rms: Math.sqrt(loudSumSq / loudSamples), clipped: clippedSamples / loudSamples })
                : !spokeAt && faintMs >= FAINT_MS
                  ? 'closer'
                  : null
            if (next !== hint) {
              hint = next
              opts.onHint?.(hint)
            }
          }
        }
        src.connect(proc)
        proc.connect(mute)
        mute.connect(ctx.destination)
        opts.onOpen?.()

        const timer = setTimeout(() => stopFn(true), MAX_CLIP_MS)
        stopFn = async (post) => {
          if (stopped) return
          stopped = true
          clearTimeout(timer)
          try {
            proc.disconnect()
            src.disconnect()
            mute.disconnect()
          } catch {}
          const rate = ctx.sampleRate
          release()
          opts.onLevel?.(0)
          // A tap, a cough, or silence: nothing to send. Whisper, given
          // silence, likes to answer "Thank you.", so silence is decided here.
          if (!post || loudMs < MIN_SPEECH_MS || peak < SILENCE_PEAK) {
            // Someone was talking, just not where the mic could hear them.
            if (post && faintMs >= FAINT_MS) opts.onStats?.({ rms: 0, clipped: 0, speechMs: 0, faint: true })
            return resolve('')
          }
          opts.onStats?.({
            rms: loudSamples ? Math.sqrt(loudSumSq / loudSamples) : 0,
            clipped: loudSamples ? clippedSamples / loudSamples : 0,
            speechMs: ((lastLoudSample - firstLoudSample) * 1000) / rate,
          })
          opts.onWorking?.()
          try {
            const speech = normalize(trimSilence(downsample(chunks, rate, rate), rate, firstLoudSample, lastLoudSample))
            const wav = encodeWav(downsample([speech], rate, TARGET_RATE), TARGET_RATE)
            const text = (await transcribe(wav, lang)).trim()
            // "Thank you" is a real learner line too, so the phrase alone never
            // drops a transcript; it takes a clip too short to have held one.
            resolve(looksHallucinated(text, loudMs) && !isExpected(text, opts.expected) ? '' : text)
          } catch (err) {
            noteSttFailure(err)
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
      cancelled = true
      stopFn(true)
    },
    cancel: () => {
      cancelled = true
      stopFn(false)
    },
  }
}

export function startListener(tier: Tier, lang: Lang, opts: ListenOptions = {}): Listener | null {
  if (tier === 'recorder') return preferBrowser ? startBrowserListener(lang, opts) : startRecorderListener(lang, opts)
  if (tier === 'browser') return startBrowserListener(lang, opts)
  return null
}
