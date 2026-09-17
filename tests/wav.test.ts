import { describe, expect, it } from 'vitest'
import { downsample, encodeWav } from '../src/speech/input'

describe('wav encoder', () => {
  it('downsamples 48 kHz to 16 kHz by a factor of three', () => {
    const chunk = new Float32Array(4800).map((_, i) => Math.sin(i / 10))
    const out = downsample([chunk, chunk], 48000, 16000)
    expect(out.length).toBe(3200)
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
