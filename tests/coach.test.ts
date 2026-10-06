import { describe, expect, it } from 'vitest'
import { distanceAdvice, normalize, paceAdvice, syllables } from '../src/speech/input'
import { usableVoices } from '../src/speech/output'

describe('mic coaching: distance', () => {
  it('says nothing about a healthy clip', () => {
    expect(distanceAdvice({ rms: 0.08, clipped: 0 })).toBeNull()
  })

  it('asks for closer when the speech is thin or was only a murmur', () => {
    expect(distanceAdvice({ rms: 0.008, clipped: 0 })).toBe('closer')
    expect(distanceAdvice({ rms: 0, clipped: 0, faint: true })).toBe('closer')
  })

  it('asks for farther when the mic is distorting', () => {
    expect(distanceAdvice({ rms: 0.2, clipped: 0.02 })).toBe('farther')
    expect(distanceAdvice({ rms: 0.4, clipped: 0 })).toBe('farther')
  })

  it('does not call silence "too far"', () => {
    expect(distanceAdvice({ rms: 0, clipped: 0 })).toBeNull()
  })
})

describe('mic coaching: pace', () => {
  // 15 syllables by the estimate: I am here to pick up a pre-scrip-tion for my mo-ther please.
  const line = 'I am here to pick up a prescription for my mother please'
  const linea = 'Vengo a recoger una receta para mi mamá, por favor'

  it('estimates syllables, dropping the silent e in English', () => {
    expect(syllables('What is her last name and date of birth?', 'en')).toBe(9)
    expect(syllables(line, 'en')).toBe(15)
    expect(syllables(linea, 'es')).toBe(19)
    expect(syllables('May 3rd, 1960', 'en')).toBe(6)
  })

  it('leaves a normal pace alone, including a short sentence said briskly', () => {
    expect(paceAdvice(line, 3300, 'en')).toBeNull()
    // The sentence that exposed the words-per-minute rule: nine syllables in 2.3 s.
    expect(paceAdvice('Sure, what is her last name and date of birth?', 2300, 'en')).toBeNull()
  })

  it('asks for slower above the band, with more room in Spanish', () => {
    expect(paceAdvice(line, 2200, 'en')).toBe('slower')
    // 19 syllables in 2.9 s is 6.6 a second: rushed English, ordinary Spanish.
    expect(paceAdvice(linea, 2900, 'es')).toBeNull()
    expect(paceAdvice(linea, 2400, 'es')).toBe('slower')
  })

  it('suggests faster only for a long, very slow line', () => {
    expect(paceAdvice(line, 9000, 'en')).toBe('faster')
  })

  it('does not judge a short answer', () => {
    expect(paceAdvice('Yes, thank you.', 400, 'en')).toBeNull()
    expect(paceAdvice('For here, please.', 1500, 'en')).toBeNull()
  })
})

describe('quiet clips are boosted before they are sent', () => {
  it('scales a quiet clip towards full scale, capped', () => {
    const out = normalize(new Float32Array([0.1, -0.2, 0.05]))
    expect(Math.max(...out.map(Math.abs))).toBeCloseTo(0.9, 5)
    expect(out[0]).toBeCloseTo(0.45, 5)
    const whisper = normalize(new Float32Array([0.001, -0.002]))
    expect(Math.max(...whisper.map(Math.abs))).toBeCloseTo(0.02, 5)
  })

  it('returns a healthy clip and a silent one untouched', () => {
    const loud = new Float32Array([0.6, -0.7])
    expect(normalize(loud)).toBe(loud)
    const zero = new Float32Array(3)
    expect(normalize(zero)).toBe(zero)
  })
})

describe('which device voices may speak', () => {
  const voices = [
    { name: 'Microsoft Sabina - Spanish (Mexico)', localService: true },
    { name: 'Google español de Estados Unidos', localService: false },
    { name: 'Bubbles', localService: true },
  ]

  it('drops network and novelty voices on a laptop', () => {
    expect(usableVoices(voices, false).map((v) => v.name)).toEqual(['Microsoft Sabina - Spanish (Mexico)'])
  })

  it('keeps the system voices on Android, where every voice reports as non-local', () => {
    const android = [
      { name: 'español Estados Unidos', localService: false },
      { name: 'English United States', localService: false },
    ]
    expect(usableVoices(android, true)).toHaveLength(2)
    expect(usableVoices(android, false)).toHaveLength(0)
  })
})
