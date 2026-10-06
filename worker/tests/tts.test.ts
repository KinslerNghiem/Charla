import { describe, expect, it, vi } from 'vitest'
import worker from '../src/index'
import type { Env } from '../src/env'
import { isShippedLine, shrinkWav, toSpeech, ttsInput, ttsModel } from '../src/tts'

vi.mock('../../public/venues.geojson', async () => {
  const fs = await import('node:fs')
  return { default: fs.readFileSync(new URL('../../public/venues.geojson', import.meta.url), 'utf8') }
})

/** A mono 16-bit PCM WAV of `n` samples at `rate`, every sample `value`. */
function wav(n: number, rate: number, value = 1000): Uint8Array {
  const out = new Uint8Array(44 + n * 2)
  const v = new DataView(out.buffer)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, value, true)
  return out
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const mp3 = () => {
  const bytes = new Uint8Array(600)
  bytes[0] = 0xff
  bytes[1] = 0xf3
  return bytes
}

function fakeEnv(run: (model: string, input: unknown) => Promise<unknown>, vars: Partial<Env> = {}) {
  const counters = new Map<string, number>()
  const DB = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (!sql.startsWith('INSERT INTO counters')) return null
              const k = String(args[0])
              const n = (counters.get(k) ?? 0) + 1
              counters.set(k, n)
              return { n }
            },
            async run() {
              return { meta: { changes: 1 } }
            },
          }
        },
      }
    },
  }
  const env = { ANTHROPIC_API_KEY: '', MODEL: '', DAILY_TURN_CAP: '40', DAILY_IP_CAP: '400', ALLOWED_ORIGIN: '', DB, AI: { run }, ...vars } as unknown as Env
  return { env, counters }
}

const post = (body: unknown) =>
  new Request('https://api.test/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('voice: the pieces', () => {
  it('fills {lang} into the model name and falls back to the default', () => {
    expect(ttsModel('@cf/deepgram/aura-2-{lang}', 'x', 'es')).toBe('@cf/deepgram/aura-2-es')
    expect(ttsModel(undefined, '@cf/myshell-ai/melotts', 'en')).toBe('@cf/myshell-ai/melotts')
  })

  it('shapes the request per model family', () => {
    expect(ttsInput('@cf/myshell-ai/melotts', 'Hola', 'es')).toEqual({ prompt: 'Hola', lang: 'es' })
    expect(ttsInput('@cf/deepgram/aura-2-en', 'Hi', 'en')).toEqual({ text: 'Hi' })
    expect(ttsInput('@cf/deepgram/aura-2-es', 'Hola', 'es', 'estrella')).toEqual({ text: 'Hola', speaker: 'estrella' })
  })

  it('halves a 44.1 kHz WAV and leaves a 16 kHz one alone', () => {
    const big = wav(1000, 44100)
    const small = shrinkWav(big)
    const v = new DataView(small.buffer)
    expect(small.byteLength).toBe(44 + 500 * 2)
    expect(v.getUint32(24, true)).toBe(22050)
    expect(v.getUint32(40, true)).toBe(1000)
    expect(v.getUint32(4, true)).toBe(36 + 1000)
    expect(v.getInt16(44, true)).toBe(1000)
    const already = wav(1000, 16000)
    expect(shrinkWav(already)).toBe(already)
  })

  it('reads both answer shapes and refuses an error body', async () => {
    const melo = await toSpeech({ audio: b64(wav(2000, 44100)) })
    expect(melo?.type).toBe('audio/wav')
    expect(melo?.bytes.byteLength).toBe(44 + 1000 * 2)
    const aura = await toSpeech(new Response(mp3()).body)
    expect(aura?.type).toBe('audio/mpeg')
    expect(aura?.bytes.byteLength).toBe(600)
    expect(await toSpeech({ audio: b64(new Uint8Array(20)) })).toBeNull()
    expect(await toSpeech(null)).toBeNull()
    expect(await toSpeech({ errors: ['nope'] })).toBeNull()
  })

  it('knows a line that ships with the app from one a model wrote', () => {
    expect(isShippedLine('Hi, how can I help you today?')).toBe(true)
    expect(isShippedLine('Estoy practicando mi español. Gracias por su paciencia.')).toBe(true)
    expect(isShippedLine('Sure, Maria. What is your address?')).toBe(false)
  })
})

describe('voice: the route', () => {
  it('reads with the natural voice first', async () => {
    const run = vi.fn(async (_model: string, _input: unknown) => new Response(mp3()).body)
    const { env } = fakeEnv(run)
    const res = await worker.fetch(post({ device: 'd', lang: 'es', text: 'Claro. Un momento.' }), env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0]).toBe('@cf/deepgram/aura-2-es')
    expect(run.mock.calls[0][1]).toEqual({ text: 'Claro. Un momento.' })
  })

  it('falls back to the cheap voice when the natural one fails', async () => {
    const run = vi.fn(async (model: string) => {
      if (model.includes('aura')) throw new Error('quota')
      return { audio: b64(wav(2000, 44100)) }
    })
    const { env } = fakeEnv(run)
    const res = await worker.fetch(post({ device: 'd', lang: 'en', text: 'One moment, please.' }), env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/wav')
    expect(run.mock.calls.map((c) => c[0])).toEqual(['@cf/deepgram/aura-2-en', '@cf/myshell-ai/melotts'])
  })

  it("goes straight to the cheap voice once the day's natural clips are spent", async () => {
    const run = vi.fn(async (_model: string, _input: unknown) => ({ audio: b64(wav(2000, 44100)) }))
    const { env } = fakeEnv(run, { DAILY_TTS_PREMIUM: '1' })
    await worker.fetch(post({ device: 'd', lang: 'en', text: 'First line.' }), env)
    await worker.fetch(post({ device: 'd', lang: 'en', text: 'Second line.' }), env)
    expect(run.mock.calls.map((c) => c[0])).toEqual(['@cf/deepgram/aura-2-en', '@cf/myshell-ai/melotts'])
  })

  it('answers 503 when no voice answers, so the app uses the device voice', async () => {
    const { env } = fakeEnv(async () => {
      throw new Error('down')
    })
    const res = await worker.fetch(post({ device: 'd', lang: 'en', text: 'Hello there.' }), env)
    expect(res.status).toBe(503)
  })

  it('refuses an empty line, a blocked line, a missing device and a missing binding', async () => {
    const run = vi.fn(async (_model: string, _input: unknown) => new Response(mp3()).body)
    const { env } = fakeEnv(run)
    expect((await worker.fetch(post({ device: 'd', lang: 'en', text: '   ' }), env)).status).toBe(400)
    expect((await worker.fetch(post({ device: 'd', lang: 'en', text: 'I want to kill myself' }), env)).status).toBe(400)
    expect((await worker.fetch(post({ lang: 'en', text: 'Hello.' }), env)).status).toBe(400)
    expect(run).not.toHaveBeenCalled()
    const { env: noAi } = fakeEnv(run, { AI: undefined })
    expect((await worker.fetch(post({ device: 'd', lang: 'en', text: 'Hello.' }), noAi)).status).toBe(503)
  })

  it('caps the voice per device on its own counter', async () => {
    const run = vi.fn(async (_model: string, _input: unknown) => new Response(mp3()).body)
    const { env, counters } = fakeEnv(run, { DAILY_TTS_CAP: '1' })
    expect((await worker.fetch(post({ device: 'd', lang: 'en', text: 'Line one.' }), env)).status).toBe(200)
    expect((await worker.fetch(post({ device: 'd', lang: 'en', text: 'Line two.' }), env)).status).toBe(429)
    expect([...counters.keys()].some((k) => k.startsWith('tts:'))).toBe(true)
    expect([...counters.keys()].some((k) => k.startsWith('dev:'))).toBe(false)
  })
})
