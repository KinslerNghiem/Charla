import { errName, log, runAi } from './env'
import { SCENES } from '../../src/content/scenes'

// The partner's voice. The phone's own synthesizer is what makes a rehearsal
// sound like a robot (and on Android Chrome often says nothing at all), so the
// line is read by a neural voice on Workers AI and sent back as audio. Nothing
// is written: the text goes to the model, the audio goes to the caller.
//
// Two models, measured on 2026-10-05 with the same two lines:
//   Deepgram Aura-2   the natural one. MP3, 15-30 KB a reply, ~2.4 s.
//                     About 130 neurons a reply.
//   MeloTTS           plainer, one model for both languages. WAV, 200-400 KB
//                     before shrinkWav halves it, ~2.5 s. About 1 neuron.
// The free tier's daily neurons are shared with the partner and with Whisper,
// and a voice that starves the conversation is worse than no voice. So Aura
// reads the first DAILY_TTS_PREMIUM clips of the day (across everyone), MeloTTS
// reads the rest, and the app falls back to the device voice when this route
// says no. On a paid plan, raise the number and Aura reads everything.

export const DEFAULT_TTS_MODEL = '@cf/deepgram/aura-2-{lang}'
export const DEFAULT_TTS_BUDGET_MODEL = '@cf/myshell-ai/melotts'
/** A partner reply is at most four short sentences; this is the bound, not the norm. */
export const MAX_TTS_CHARS = 320

export interface Speech {
  bytes: Uint8Array
  type: string
}

type Lang = 'en' | 'es'

export function ttsModel(configured: string | undefined, fallback: string, lang: Lang): string {
  return (configured || fallback).replace('{lang}', lang)
}

/** The two request shapes on Workers AI: MeloTTS takes a prompt and a language, Aura takes text and a speaker. */
export function ttsInput(model: string, text: string, lang: Lang, speaker?: string): Record<string, unknown> {
  if (model.includes('melotts')) return { prompt: text, lang }
  return speaker ? { text, speaker } : { text }
}

function sniff(bytes: Uint8Array): string {
  const tag = String.fromCharCode(...bytes.subarray(0, 4))
  if (tag === 'RIFF') return 'audio/wav'
  if (tag === 'OggS') return 'audio/ogg'
  return 'audio/mpeg'
}

/**
 * Halves a 16-bit mono PCM WAV sampled above 32 kHz by averaging sample pairs.
 * MeloTTS answers at 44.1 kHz, which is twice what a voice needs and twice what
 * a prepaid data plan wants to download. Anything else comes back untouched.
 */
export function shrinkWav(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength < 46 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF') return bytes
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const pcm = v.getUint16(20, true) === 1
  const mono = v.getUint16(22, true) === 1
  const rate = v.getUint32(24, true)
  const bits = v.getUint16(34, true)
  const isData = String.fromCharCode(...bytes.subarray(36, 40)) === 'data'
  if (!pcm || !mono || bits !== 16 || rate <= 32000 || !isData) return bytes
  const inSamples = Math.floor((bytes.byteLength - 44) / 2)
  const outSamples = Math.floor(inSamples / 2)
  const out = new Uint8Array(44 + outSamples * 2)
  out.set(bytes.subarray(0, 44))
  const o = new DataView(out.buffer)
  const half = Math.round(rate / 2)
  o.setUint32(4, 36 + outSamples * 2, true)
  o.setUint32(24, half, true)
  o.setUint32(28, half * 2, true)
  o.setUint32(40, outSamples * 2, true)
  for (let i = 0; i < outSamples; i++) {
    const a = v.getInt16(44 + i * 4, true)
    const b = v.getInt16(46 + i * 4, true)
    o.setInt16(44 + i * 2, (a + b) >> 1, true)
  }
  return out
}

/** Normalises what the binding hands back: MeloTTS answers {audio: base64}, Aura answers a byte stream. */
export async function toSpeech(res: unknown): Promise<Speech | null> {
  let bytes: Uint8Array | null = null
  const audio = (res as { audio?: unknown } | null)?.audio
  if (typeof audio === 'string') {
    const bin = atob(audio)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } else if (res instanceof Uint8Array) {
    bytes = res
  } else if (res instanceof ArrayBuffer) {
    bytes = new Uint8Array(res)
  } else if (res instanceof Response) {
    bytes = new Uint8Array(await res.arrayBuffer())
  } else if (res && typeof (res as ReadableStream).getReader === 'function') {
    bytes = new Uint8Array(await new Response(res as ReadableStream).arrayBuffer())
  }
  // A real clip of even one word is kilobytes; anything smaller is an error body.
  if (!bytes || bytes.byteLength < 200) return null
  bytes = shrinkWav(bytes)
  return { bytes, type: sniff(bytes) }
}

/** Returns null when the model cannot be reached or answers nonsense. */
export async function synthesize(ai: Ai, model: string, text: string, lang: Lang, speaker?: string): Promise<Speech | null> {
  try {
    return await toSpeech(await runAi(ai, model, ttsInput(model, text, lang, speaker)))
  } catch (err) {
    log({ route: 'tts', model, error: errName(err) })
    return null
  }
}

// Lines that ship with the app (the scripted partner lines, the phrases on the
// Go Card, the line to show the staff) are the same for everyone, so their
// audio can sit in the edge cache. A reply the model wrote for one learner is
// never cached: "not stored" has to stay true of anything a learner shaped.
let shipped: Set<string> | null = null
export function isShippedLine(text: string): boolean {
  if (!shipped) {
    const set = new Set<string>()
    const add = (b: { en: string; es: string }) => {
      set.add(b.en.trim())
      set.add(b.es.trim())
    }
    for (const s of SCENES) {
      add(s.show_staff_line)
      s.must_use.forEach(add)
      if (s.expect) add(s.expect)
      for (const node of Object.values(s.offline_script.nodes)) {
        add(node.partner)
        node.choices.forEach((c) => add(c.text))
      }
    }
    shipped = set
  }
  return shipped.has(text.trim())
}
