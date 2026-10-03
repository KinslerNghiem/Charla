import { describe, expect, it } from 'vitest'
import { classify, downsample, encodeWav, looksHallucinated, noteSttFailure, prefersBrowser, trimSilence } from '../src/speech/input'

describe('wav encoder', () => {
  it('downsamples 48 kHz to 16 kHz by a factor of three', () => {
    const chunk = new Float32Array(4800).map((_, i) => Math.sin(i / 10))
    const out = downsample([chunk, chunk], 48000, 16000)
    expect(out.length).toBe(3200)
  })

  it('keeps a constant signal constant through the box filter', () => {
    const chunk = new Float32Array(4800).fill(0.5)
    const out = downsample([chunk], 48000, 16000)
    for (const s of out) expect(s).toBeCloseTo(0.5, 6)
  })

  it('turns 44100 samples at 44.1 kHz into exactly 16000', () => {
    const out = downsample([new Float32Array(44100).fill(0.25)], 44100, 16000)
    expect(out.length).toBe(16000)
    expect(out[15999]).toBeCloseTo(0.25, 6)
  })

  it('concatenates verbatim at the same rate', () => {
    const out = downsample([new Float32Array([1, 2]), new Float32Array([3])], 16000, 16000)
    expect(Array.from(out)).toEqual([1, 2, 3])
  })

  it('encodes an empty clip as a bare 44-byte header', async () => {
    const blob = encodeWav(new Float32Array(0), 16000)
    expect(blob.size).toBe(44)
    const v = new DataView(await blob.arrayBuffer())
    expect(v.getUint32(4, true)).toBe(36)
    expect(v.getUint32(40, true)).toBe(0)
  })

  it('clips samples beyond full scale', async () => {
    const v = new DataView(await encodeWav(new Float32Array([2, -2]), 16000).arrayBuffer())
    expect(v.getInt16(44, true)).toBe(0x7fff)
    expect(v.getInt16(46, true)).toBe(-0x8000)
  })

  it('writes a valid 44-byte header and 16-bit samples', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const blob = encodeWav(samples, 16000)
    expect(blob.type).toBe('audio/wav')
    const v = new DataView(await blob.arrayBuffer())
    const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(tag(12)).toBe('fmt ')
    expect(tag(36)).toBe('data')
    expect(v.getUint16(22, true)).toBe(1) // mono
    expect(v.getUint32(24, true)).toBe(16000)
    expect(v.getUint16(34, true)).toBe(16)
    expect(v.getUint32(40, true)).toBe(10)
    expect(v.getInt16(44, true)).toBe(0)
    expect(v.getInt16(46, true)).toBe(Math.round(0.5 * 0x7fff))
    expect(v.getInt16(50, true)).toBe(0x7fff)
    expect(v.getInt16(52, true)).toBe(-0x8000)
  })
})

describe('clip trimming', () => {
  it('keeps 300 ms around the speech and drops the rest', () => {
    const rate = 1000 // 1 sample per ms keeps the arithmetic readable
    const all = new Float32Array(5000)
    // Speech from 2000 to 3000; the silence tail after it is what the auto-stop waited through.
    const out = trimSilence(all, rate, 2000, 3000)
    expect(out.length).toBe(1600)
    expect(out.byteOffset / 4).toBe(1700)
  })

  it('never reaches past the ends of the clip', () => {
    const out = trimSilence(new Float32Array(1000), 1000, 100, 950)
    expect(out.length).toBe(1000)
  })

  it('leaves a clip with no loud part alone', () => {
    const all = new Float32Array(1000)
    expect(trimSilence(all, 1000, 0, 0)).toBe(all)
  })
})

describe('silence hallucinations', () => {
  it('drops "Thank you." only when the clip was too short to have held it', () => {
    expect(looksHallucinated('Thank you.', 500)).toBe(true)
    expect(looksHallucinated('Gracias', 500)).toBe(true)
    expect(looksHallucinated('Subtítulos realizados por la comunidad de Amara.org', 500)).toBe(true)
    expect(looksHallucinated('Thank you.', 1500)).toBe(false)
    expect(looksHallucinated('Necesito mi receta', 500)).toBe(false)
  })
})

describe('talk errors', () => {
  it('tells a cap, a dead network and a bad mic apart', () => {
    expect(classify({ name: 'NotAllowedError' })).toBe('denied')
    expect(classify({ name: 'NotFoundError' })).toBe('unavailable')
    expect(classify({ name: 'ApiError', status: 429 })).toBe('capped')
    expect(classify({ name: 'ApiError', status: 503 })).toBe('unavailable')
    expect(classify({ name: 'ApiError', status: 500 })).toBe('failed')
    expect(classify(new TypeError('Failed to fetch'))).toBe('offline')
    expect(classify({ name: 'AbortError' })).toBe('offline')
  })

  it('falls back to the browser recognizer only on a 503 and only where there is one', () => {
    noteSttFailure({ status: 500 }, true)
    expect(prefersBrowser()).toBe(false)
    noteSttFailure({ status: 503 }, false)
    expect(prefersBrowser()).toBe(false)
    noteSttFailure({ status: 503 }, true)
    expect(prefersBrowser()).toBe(true)
  })
})
