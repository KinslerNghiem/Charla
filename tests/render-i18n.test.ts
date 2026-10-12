import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { h, type ComponentType, type VNode } from 'preact'
import { render } from 'preact-render-to-string'
import { STRINGS, type Lang } from '../src/i18n/strings'

// Every page, rendered in both interface languages and both directions, and
// read back the way a screen reader would: each piece of text with the
// language its markup claims for it. Three things are checked on every render:
//
//   1. nothing reads as a raw key (type_pharmacy) or as "undefined";
//   2. no text in the interface language is one of the OTHER language's UI
//      strings, which is what a hardcoded or mis-routed label looks like;
//   3. the content in the other language (the partner's lines, the glosses)
//      carries a lang attribute, so it is pronounced right.
//
// Then the switch itself: changing the interface language re-renders the chrome
// and leaves the scene content, the state and the rest of storage untouched.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- every page has its own props; the test only mounts them.
type Page = ComponentType<any>

interface Pages {
  App: Page
  Learn: Page
  Card: Page
  Places: Page
  Table: Page
  Privacy: Page
  About: Page
  Ninos: Page
  BirthGate: Page
}
type LangModule = typeof import('../src/i18n/lang')

let P: Pages
let L: LangModule
const store = new Map<string, string>()

// What a text node is, and in which language the markup says it is.
interface Node {
  text: string
  lang: string
  where: string
}

const RAW_KEY = /^[a-z]+(_[a-z0-9]+)+$/i
const SPOKEN_ATTR = /\b(aria-label|placeholder|title|alt)="([^"]*)"/g

function decode(s: string): string {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** Walks the HTML and returns every text node and spoken attribute with its effective lang. */
export function nodes(html: string, docLang: string): Node[] {
  const out: Node[] = []
  const stack: string[] = [docLang]
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g
  for (const m of html.matchAll(re)) {
    if (m[5] !== undefined) {
      const text = decode(m[5]).trim()
      if (text) out.push({ text, lang: stack[stack.length - 1], where: 'text' })
      continue
    }
    const [, close, tag, attrs, selfClose] = m
    if (close) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const own = /\blang="([^"]*)"/.exec(attrs)?.[1]
    const lang = own || stack[stack.length - 1]
    for (const a of attrs.matchAll(SPOKEN_ATTR)) {
      const text = decode(a[2]).trim()
      if (text) out.push({ text, lang, where: a[1] })
    }
    // preact-render-to-string closes void elements with "/>" and everything
    // else with an end tag, so the stack balances on that alone.
    if (!selfClose) stack.push(lang)
    void tag
  }
  return out
}

const en = STRINGS.en as Record<string, string>
const es = STRINGS.es as Record<string, string>
/** UI strings that exist only in one language: seeing one in the other language's chrome is a leak. */
const ONLY: Record<Lang, Set<string>> = {
  en: new Set(Object.keys(en).filter((k) => en[k] !== es[k]).map((k) => en[k])),
  es: new Set(Object.keys(es).filter((k) => en[k] !== es[k]).map((k) => es[k])),
}

function setup(ui: Lang, learning: Lang, extra: Record<string, unknown> = {}) {
  store.clear()
  store.set('charla.native', JSON.stringify(ui))
  store.set('charla.lang', JSON.stringify(ui))
  store.set('charla.learning', JSON.stringify(learning))
  store.set('charla.mode', JSON.stringify('adult'))
  for (const [k, v] of Object.entries(extra)) store.set('charla.' + k, JSON.stringify(v))
  L.setLang(ui)
}

function check(html: string, ui: Lang, name: string): Node[] {
  const list = nodes(html, ui)
  expect(list.length, `${name} rendered nothing`).toBeGreaterThan(0)
  const other: Lang = ui === 'es' ? 'en' : 'es'
  for (const n of list) {
    expect(n.text, `${name}: raw key or empty value in ${n.where}`).not.toMatch(RAW_KEY)
    expect(n.text, `${name}: ${n.where}`).not.toMatch(/^(undefined|null|NaN)$/)
    if (n.lang === ui) {
      expect(ONLY[other].has(n.text), `${name}: ${other.toUpperCase()} string "${n.text}" in a ${ui.toUpperCase()} interface`).toBe(false)
    }
  }
  return list
}

const stubbed: string[] = []
function stub(name: string, value: unknown) {
  if (!(name in globalThis)) stubbed.push(name)
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

beforeAll(async () => {
  stub('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  })
  const bus = new EventTarget()
  stub('dispatchEvent', (e: Event) => bus.dispatchEvent(e))
  stub('addEventListener', (t: string, l: EventListener) => bus.addEventListener(t, l))
  stub('removeEventListener', (t: string, l: EventListener) => bus.removeEventListener(t, l))
  if (!('document' in globalThis)) stub('document', { documentElement: { lang: '' } })
  stub('location', { hash: '#/learn' })
  L = await import('../src/i18n/lang')
  // Charlita is not in src/pages: app.tsx imports it statically so kid mode
  // never loads the networked chunk (tests/ninos-offline.test.ts).
  const [app, pages, ninos, gate] = await Promise.all([import('../src/app'), import('../src/pages'), import('../src/pages/Ninos'), import('../src/gate/BirthGate')])
  P = { App: app.App as Page, ...(pages as unknown as Omit<Pages, 'App' | 'BirthGate' | 'Ninos'>), Ninos: ninos.Ninos as Page, BirthGate: gate.BirthGate as Page }
})

afterAll(() => {
  for (const n of stubbed.splice(0)) delete (globalThis as Record<string, unknown>)[n]
})

const params = (q = '') => new URLSearchParams(q)
const CARD = { scene_id: 'pharmacy-refill', place: 'Walgreens', level: 'A2', ts: 1 }

const PAGES: [string, (p: Pages) => VNode, Record<string, unknown>?][] = [
  ['app shell', (p) => h(p.App, {}), {}],
  ['scene picker', (p) => h(p.Learn, { params: params() }), { rehearsed: ['bus-ride'], lastScene: 'clinic-front-desk' }],
  ['scene, before the first line', (p) => h(p.Learn, { params: params('scene=pharmacy-refill&place=Walgreens') }), {}],
  ['Go Card', (p) => h(p.Card, {}), { lastCard: CARD }],
  ['Go Card, empty', (p) => h(p.Card, {}), {}],
  ['Places', (p) => h(p.Places, { params: params('type=pharmacy') }), { streak: [{ ts: Date.now(), place_id: 'x', how: 'easy' }] }],
  ['Table', (p) => h(p.Table, { params: params() }), {}],
  ['Privacy', (p) => h(p.Privacy, {}), {}],
  ['About', (p) => h(p.About, {}), {}],
  ['Charlita', (p) => h(p.Ninos, {}), { stickers: ['taqueria-order'] }],
  ['birth gate', (p) => h(p.BirthGate, { onDone: () => {} }), {}],
]

describe('every page renders in both interface languages, for both directions', () => {
  for (const ui of ['es', 'en'] as Lang[]) {
    for (const learning of ['en', 'es'] as Lang[]) {
      for (const [name, make, extra] of PAGES) {
        it(`${name}: interface ${ui}, practicing ${learning}`, () => {
          setup(ui, learning, extra)
          const html = render(make(P))
          const list = check(html, ui, name)
          // The scene pages put the other language on the screen; it has to be marked.
          if (/scene|Card$|Charlita/.test(name) && learning !== ui) {
            expect(list.some((n) => n.lang === learning), `${name}: no content marked lang="${learning}"`).toBe(true)
          }
        })
      }
    }
  }
})

describe('switching the interface language', () => {
  it('re-labels the chrome and keeps the scene content and the rest of storage', () => {
    setup('es', 'en', { rehearsed: ['bus-ride'], lastCard: CARD })
    const before = nodes(render(h(P.Learn, { params: params('scene=pharmacy-refill') })), 'es')
    const snapshot = JSON.stringify([...store.entries()].filter(([k]) => k !== 'charla.lang'))

    L.toggleLang()
    expect(L.lang()).toBe('en')
    expect(L.learning()).toBe('en')
    const after = nodes(render(h(P.Learn, { params: params('scene=pharmacy-refill') })), 'en')

    // The partner's language did not move, so every English line is still there...
    const content = (list: Node[]) => list.filter((n) => n.lang === 'en' && n.where === 'text').map((n) => n.text)
    for (const line of content(before)) expect(content(after)).toContain(line)
    // ...while the labels changed language.
    expect(after.some((n) => n.text === STRINGS.en.brief_label)).toBe(true)
    expect(before.some((n) => n.text === STRINGS.es.brief_label)).toBe(true)
    // Nothing else in storage was touched: progress, the card, the direction, the answer.
    expect(JSON.stringify([...store.entries()].filter(([k]) => k !== 'charla.lang'))).toBe(snapshot)
  })

  it('does not send the learner back to the first screen', () => {
    setup('es', 'en')
    expect(render(h(P.App, {}))).toContain('class="tabs"')
    L.toggleLang()
    const html = render(h(P.App, {}))
    expect(html).toContain('class="tabs"')
    expect(html).not.toContain('langpick')
    expect(html).toContain(`>${STRINGS.en.nav_learn}<`)
  })

  it('names the other language on the chip, in that language', () => {
    setup('es', 'en')
    expect(render(h(P.App, {}))).toMatch(/lang="en"[^>]*>[\s\S]*?English<\/button>/)
    L.toggleLang()
    expect(render(h(P.App, {}))).toMatch(/lang="es"[^>]*>[\s\S]*?Español<\/button>/)
  })

  it('offers the direction switch on the picker and nowhere inside a conversation', () => {
    setup('es', 'en')
    const picker = render(h(P.Learn, { params: params() }))
    expect(picker).toContain(STRINGS.es.direction_to_es)
    expect(picker).toContain(STRINGS.es.lang_name_en)
    const scene = render(h(P.Learn, { params: params('scene=pharmacy-refill') }))
    expect(scene).not.toContain(STRINGS.es.direction_to_es)
    L.setLearning('es')
    expect(L.lang()).toBe('es')
    expect(render(h(P.Learn, { params: params() }))).toContain(STRINGS.es.direction_to_en)
  })
})

describe('the first screen', () => {
  it('asks in both languages, with each answer marked in its own', async () => {
    const { LangPick } = await import('../src/gate/LangPick')
    const html = render(h(LangPick as Page, { onPick: () => {} }))
    expect(html).toContain('lang="es"')
    expect(html).toContain('lang="en"')
    expect(html).toContain('Hablo español')
    expect(html).toContain('I speak English')
  })
})
