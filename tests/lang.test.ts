import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// src/i18n/lang.ts reads storage and sets <html lang> at import time, so each
// test resets the module registry and imports it fresh against a clean stub.

function fakeStorage() {
  const store = new Map<string, string>()
  const api = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  return new Proxy(api as unknown as Storage, {
    get: (target, prop) => (prop in target ? (target as unknown as Record<PropertyKey, unknown>)[prop] : store.get(String(prop))),
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (_t, prop) =>
      store.has(String(prop)) ? { value: store.get(String(prop)), enumerable: true, configurable: true, writable: true } : undefined,
  })
}

const stubbed: string[] = []
function stub(name: string, value: unknown) {
  if (!(name in globalThis)) stubbed.push(name)
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

async function load() {
  vi.resetModules()
  return import('../src/i18n/lang')
}

describe('language answer', () => {
  beforeEach(() => {
    stub('localStorage', fakeStorage())
    // lang.ts dispatches a 'charla:lang' event on window; Node has EventTarget
    // but no window-level dispatchEvent.
    const bus = new EventTarget()
    stub('dispatchEvent', (e: Event) => bus.dispatchEvent(e))
    stub('addEventListener', (t: string, l: EventListener) => bus.addEventListener(t, l))
    stub('removeEventListener', (t: string, l: EventListener) => bus.removeEventListener(t, l))
    if (!('document' in globalThis)) stub('document', { documentElement: { lang: '' } })
  })
  afterEach(() => {
    for (const n of stubbed.splice(0)) delete (globalThis as Record<string, unknown>)[n]
  })

  it('setNative("es") makes the interface Spanish and the partner English', async () => {
    const m = await load()
    m.setNative('es')
    expect(m.lang()).toBe('es')
    expect(m.learning()).toBe('en')
    expect(m.native()).toBe('es')
    expect(m.hasNative()).toBe(true)
    expect(document.documentElement.lang).toBe('es')
  })

  it('setNative("en") makes the partner Spanish', async () => {
    const m = await load()
    m.setNative('en')
    expect(m.lang()).toBe('en')
    expect(m.learning()).toBe('es')
    expect(m.native()).toBe('en')
  })

  it('clearNative forgets the answer but not the direction', async () => {
    const m = await load()
    m.setNative('es')
    m.clearNative()
    expect(m.hasNative()).toBe(false)
    expect(m.learning()).toBe('en')
    expect(m.lang()).toBe('es')
  })

  it('sets <html lang> from storage on init, so a reload keeps the document language', async () => {
    localStorage.setItem('charla.lang', '"en"')
    document.documentElement.lang = 'es'
    const m = await load()
    expect(document.documentElement.lang).toBe('en')
    expect(m.lang()).toBe('en')
  })

  it('t() reads the current language and tIn() a named one', async () => {
    const m = await load()
    m.setNative('es')
    expect(m.t('nav_learn')).toBe(m.tIn('es', 'nav_learn'))
    expect(m.tIn('en', 'nav_learn')).not.toBe('')
  })
})
