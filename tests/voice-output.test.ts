import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hush, speak } from '../src/speech/output'

// The device voice's one timing rule: Chrome on Android drops an utterance
// queued in the same tick as a cancel(). voice.ts always hushes the previous
// line before handing the next one to speak(), so the gap has to be observed
// here, not left to the caller. A speechSynthesis stand-in with one local
// Spanish voice records what was spoken and when.

class FakeUtterance {
  text: string
  lang = ''
  voice: unknown = null
  rate = 1
  volume = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function fakeSynth() {
  const spoken: string[] = []
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => [{ name: 'Paulina', lang: 'es-MX', localService: true }],
    speak(u: FakeUtterance) {
      spoken.push(u.text)
    },
    cancel() {},
    addEventListener() {},
  }
  return { synth, spoken }
}

const stubbed: string[] = []
function stub(name: string, value: unknown) {
  if (!(name in globalThis)) stubbed.push(name)
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

describe('device voice after a cancel', () => {
  let spoken: string[]
  beforeEach(() => {
    vi.useFakeTimers()
    const f = fakeSynth()
    spoken = f.spoken
    stub('window', globalThis)
    stub('speechSynthesis', f.synth)
    stub('SpeechSynthesisUtterance', FakeUtterance)
    // Well past any settle window left by the previous test.
    vi.advanceTimersByTime(1000)
  })
  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
    for (const n of stubbed.splice(0)) delete (globalThis as Record<string, unknown>)[n]
  })

  it('speaks at once when nothing was cancelled', () => {
    expect(speak('Buenos días.', 'es')).toBe(true)
    expect(spoken).toEqual(['Buenos días.'])
  })

  it('waits a beat after hush() before speaking', () => {
    hush()
    expect(speak('Un momento.', 'es')).toBe(true)
    expect(spoken).toEqual([])
    vi.advanceTimersByTime(100)
    expect(spoken).toEqual(['Un momento.'])
  })

  it('drops the pending line when a hush lands inside that beat', () => {
    hush()
    speak('Un momento.', 'es')
    hush()
    vi.advanceTimersByTime(100)
    expect(spoken).toEqual([])
    // ...and the next line still goes out.
    speak('Claro.', 'es')
    vi.advanceTimersByTime(100)
    expect(spoken).toEqual(['Claro.'])
  })
})
