// Screenshot every page of the app at phone size in the Chrome already on this
// machine, and report console errors, failed requests, and every request kid
// mode makes. A screenshot beats reasoning about layout.
//
//   npm run dev            (in one terminal)
//   npm run walk           (in another; shots land in .walk/)
//
// Set WALK_BASE to point somewhere else (a `vite preview`, a deployed build).
// Needs Chrome or Edge installed. No browser download: playwright-core drives
// the installed one through the `channel` option.
//
// Each section runs inside its own try/catch and the script keeps going, so
// one broken page costs one missing picture, not the whole walk. The exit
// code is 1 when any section failed, a page threw, or kid mode touched the
// network.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

// Vite binds to localhost, which on Windows resolves to ::1 first; 127.0.0.1
// is refused there.
const BASE = process.env.WALK_BASE ?? 'http://localhost:5173'
const OUT = path.resolve('.walk') + path.sep
fs.mkdirSync(OUT, { recursive: true })

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true })
    } catch {}
  }
  throw new Error('No Chrome or Edge found. Install one, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.')
}

const browser = await launch()
const report = { errors: [], failed: [], kidNet: [], sections: {}, notes: [] }

async function fresh(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-US',
    colorScheme: opts.dark ? 'dark' : 'light',
    ...opts.ctx,
  })
  const page = await ctx.newPage()
  const tag = opts.tag ?? ''
  page.on('console', (m) => {
    // An HTTP error from /api/* is the Worker (or the CI stub, or Vite's proxy
    // with no Worker behind it) saying "no model here". The app handles that
    // by design (scripted scene, retry), so it is not a page error. Offline
    // passes fail every fetch on purpose.
    if (m.type() !== 'error') return
    const url = m.location()?.url ?? ''
    if (/\/api\//.test(url) && /status of \d{3}/.test(m.text())) return
    if (/status of (503|429)/.test(m.text())) return
    if (opts.offline && /Failed to (fetch|load)|ERR_INTERNET_DISCONNECTED|net::/.test(m.text())) return
    report.errors.push(`[${tag}] ${m.text()}${url ? ' (' + url + ')' : ''}`)
  })
  page.on('pageerror', (e) => report.errors.push(`[${tag}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => {
    if (opts.offline) return
    // ERR_ABORTED is a request cancelled by navigation or by MapLibre dropping a
    // tile it no longer needs; nothing failed.
    if (r.failure()?.errorText === 'net::ERR_ABORTED') return
    report.failed.push(`[${tag}] ${r.url()} ${r.failure()?.errorText}`)
  })
  return { ctx, page }
}

async function shot(page, name, full = true) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: OUT + name + '.png', fullPage: full })
}

// The first screen asks which language you speak; the second asks month and
// year of birth. Both are answered here. `native` picks the interface language
// ('es' is the primary audience, 'en' the reverse direction).
async function passGate(page, year, native = 'es') {
  await page.goto(BASE + '/#/learn')
  await page.waitForSelector('.langpick button', { timeout: 15000 })
  await page.click(native === 'es' ? 'button[lang="es"]' : 'button[lang="en"]')
  await page.waitForSelector('select')
  await page.selectOption('select', '6')
  await page.fill('input[inputmode="numeric"]', String(year))
  await page.click('button[type=submit]')
  await page.waitForSelector('nav.tabs, .shell.kid', { timeout: 15000 })
}

const sectionOpts = {
  dark: { dark: true },
  desktop: { ctx: { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false } },
  'places-offline': { offline: true },
}

// Run a section; one failure is recorded and the walk goes on.
async function section(name, fn) {
  let ctx
  const open = async () => {
    const x = await fresh({ tag: name, ...sectionOpts[name] })
    ctx = x.ctx
    return x
  }
  try {
    await fn(open)
    report.sections[name] = 'ok'
  } catch (e) {
    report.sections[name] = 'FAILED: ' + (e?.message ?? String(e)).split('\n')[0]
    process.exitCode = 1
  } finally {
    try {
      await ctx?.close()
    } catch {}
  }
}

// Language question, then the birth gate (in Spanish, since that was the answer).
await section('gate', async (open) => {
  const { page } = await open()
  await page.goto(BASE + '/')
  await page.waitForSelector('.langpick button')
  await shot(page, '01-langpick')
  await page.click('button[lang="es"]')
  await page.waitForSelector('select')
  await shot(page, '01b-birth-gate')
})

// Adult, Spanish speaker learning English: the picker, a scene with two turns.
await section('adult-learn', async (open) => {
  const { page } = await open()
  await passGate(page, 1990)
  await shot(page, '02-picker')
  report.notes.push('scene cards: ' + (await page.locator('.scene-card').count()))

  await page.click('.scene-card >> nth=0')
  await page.waitForSelector('.composer, .offline-scene', { state: 'attached', timeout: 15000 })
  await shot(page, '04-scene')
  const ta = page.locator('textarea')
  if (await ta.count()) {
    await ta.fill('Hello, I need to refill my prescription.')
    await page.keyboard.press('Enter')
    // Live partner, or a 503 that drops into the scripted scene. Wait for either.
    await page.waitForSelector('.offline-scene, ol li:nth-child(2)', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, '05-scene-turn-1')
    if (await page.locator('textarea').count()) {
      await page.fill('textarea', 'It is for my mother.')
      await page.click('button[type=submit]')
      await page.waitForTimeout(6000)
      await shot(page, '06-scene-turn-2')
    }
  } else {
    report.notes.push('scene opened in scripted mode (no textarea)')
  }
})

// English speaker learning Spanish: the picker in English.
await section('picker-en', async (open) => {
  const { page } = await open()
  await passGate(page, 1990, 'en')
  await shot(page, '03-picker-en')
  const h = await page.locator('html').getAttribute('lang')
  report.notes.push('html lang after English answer: ' + h)
})

// Go Card, Places (a venue selected, a report), Table, Kids tab, Privacy, About, focus ring.
await section('adult-pages', async (open) => {
  const { page } = await open()
  await passGate(page, 1990)

  await page.goto(BASE + '/#/card')
  await shot(page, '07-card')

  await page.goto(BASE + '/#/places')
  await page.waitForSelector('.venue-row', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)
  await shot(page, '08-places')
  const row = page.locator('.venue-row')
  report.notes.push('venue rows: ' + (await row.count()))
  if (await row.count()) {
    await row.first().click()
    await page.waitForSelector('.venue', { timeout: 5000 }).catch(() => {})
    await shot(page, '09-place-selected')
    const went = page.locator('button', { hasText: /^F[áa]cil$|^Easy$/ })
    if (await went.count()) {
      await went.first().click()
      await page.waitForTimeout(800)
      await shot(page, '10-place-reported')
    } else {
      report.notes.push('no "Easy" button on the selected venue (report flow not reached)')
    }
  }

  await page.goto(BASE + '/#/table')
  await shot(page, '11-table')
  const start = page.locator('button.primary').first()
  if (await start.count()) {
    await start.click()
    await page.waitForTimeout(800)
    await shot(page, '12-table-running')
  }

  await page.goto(BASE + '/#/ninos')
  await shot(page, '13-kids-tab')
  await page.goto(BASE + '/#/privacy')
  await shot(page, '14-privacy')

  await page.goto(BASE + '/#/about')
  await page.waitForTimeout(500)
  await shot(page, '14b-about')
  const h1 = (await page.locator('main h1, main h2').first().textContent().catch(() => '')) ?? ''
  report.notes.push('about page heading: ' + JSON.stringify(h1.trim()))

  await page.goto(BASE + '/#/learn')
  await page.waitForTimeout(300)
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
  await shot(page, '15-keyboard-focus', false)
})

// Places opened with the network gone after the app's first load: the map
// cannot draw, the page must say so (the map_offline notice). The list is only
// as good as the cache: in dev there is no service worker, so its row count is
// a note, not a failure; against a production build (vite preview) the rows
// should be there. (Opening Places once online first would let Chrome's HTTP
// cache serve the map style, which is a different, happier case.)
await section('places-offline', async (open) => {
  const { ctx, page } = await open()
  await passGate(page, 1990)
  await page.waitForTimeout(500) // let the pages chunk land
  await ctx.setOffline(true)
  await page.evaluate(() => {
    location.hash = '#/places'
  })
  await page.waitForTimeout(3000)
  await shot(page, '08b-places-offline')
  const notices = await page.locator('.notice, [role=status], .map-offline, .offline').allTextContents()
  const text = notices.join(' | ')
  report.notes.push('offline places notice: ' + JSON.stringify(text))
  report.notes.push('offline venue rows: ' + (await page.locator('.venue-row').count()))
  if (!/conexi[oó]n|connection|offline|internet|signal|se[ñn]al/i.test(text)) {
    throw new Error('no offline notice on Places with the network off; saw: ' + JSON.stringify(text))
  }
  await ctx.setOffline(false)
})

// Kid mode: watch every request it makes. Anything under /api/, any map tile,
// anything off-origin, and any networked module is a failure.
await section('kid', async (open) => {
  const { page } = await open()
  page.on('request', (r) => {
    const u = r.url()
    if (/tiles\.openfreemap\.org|\/api\//.test(u)) report.kidNet.push('FORBIDDEN ' + u)
    else if (!u.startsWith(BASE)) report.kidNet.push('EXTERNAL ' + u)
    // About is static (the idea, the numbers, the disclosure) and may load in
    // kid mode; tests/ninos-offline.test.ts checks that it imports nothing networked.
    else if (/maplibre|\/pages\/(?!Ninos|About)|tutor\/client|speech\/input/.test(u)) report.kidNet.push('NETWORKED MODULE ' + u)
  })
  await passGate(page, 2018)
  await shot(page, '16-kid-street')
  await page.click('.storefront >> nth=0')
  await shot(page, '17-kid-scene')
  await page.click('.choice >> nth=0')
  await shot(page, '18-kid-choice')
  await page.reload()
  await page.waitForSelector('.storefront, .ninos', { timeout: 15000 })
  await page.waitForTimeout(800)
  await shot(page, '19-kid-reload')

  // Grown-ups panel: hold the button for three seconds.
  const hold = page.locator('.hold')
  if (await hold.count()) {
    await hold.dispatchEvent('pointerdown')
    await page.waitForTimeout(3300)
    await hold.dispatchEvent('pointerup').catch(() => {})
    await page.waitForSelector('.grownups', { timeout: 3000 })
    await shot(page, '19b-kid-grownups')
  } else {
    report.notes.push('no .hold button on the kid street (grown-ups panel not reached)')
  }
})

// Dark mode and desktop, once each.
await section('dark', async (open) => {
  const { page } = await open()
  await passGate(page, 1990)
  await page.click('.scene-card >> nth=0')
  await page.waitForSelector('.composer, .offline-scene', { state: 'attached', timeout: 15000 })
  await shot(page, '20-dark-scene')
})
await section('desktop', async (open) => {
  const { page } = await open()
  await passGate(page, 1990)
  await shot(page, '21-desktop', false)
})

await browser.close()
fs.writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`\nScreenshots in ${OUT}`)
const failedSections = Object.values(report.sections).filter((s) => s !== 'ok').length
if (report.errors.length || report.kidNet.length || failedSections) process.exitCode = 1
