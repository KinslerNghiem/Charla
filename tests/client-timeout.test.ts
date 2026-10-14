import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A turn request that never answers must fail on its own, so the page can
// show the scripted scene instead of a spinner. The abort arrives as an
// ordinary rejection, which Learn treats as "no connection".

describe('askTutor', () => {
  const stubbed: string[] = []
  function stub(name: string, value: unknown) {
    if (!(name in globalThis)) stubbed.push(name)
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    for (const n of stubbed.splice(0)) delete (globalThis as Record<string, unknown>)[n]
  })

  it('gives up after the post timeout and clears its timer', async () => {
    let aborted = false
    stub(
      'fetch',
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => {
            aborted = true
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    vi.resetModules()
    const { askTutor, POST_TIMEOUT_MS } = await import('../src/tutor/client')
    const p = askTutor({ scene_id: 'pharmacy-refill', level: 'A2', learning: 'en', history: [], user: 'Hello.' })
    const settled = p.then(
      () => 'resolved',
      (e: Error) => e.name,
    )
    await vi.advanceTimersByTimeAsync(POST_TIMEOUT_MS + 1)
    expect(await settled).toBe('AbortError')
    expect(aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
