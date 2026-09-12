// Screenshot every page of the app at phone size in the Chrome already on this
// machine, and report console errors, failed requests, and every request kid
// mode makes. A screenshot beats reasoning about layout.
//
//   npm run dev            (in one terminal)
//   npm run walk           (in another; shots land in .walk/)
//
// Needs Chrome or Edge installed. No browser download: playwright-core drives
// the installed one through the `channel` option.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.WALK_BASE ?? 'http://127.0.0.1:5173'
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
const report = { errors: [], failed: [], kidNet: [], notes: [] }

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
    // A 503 from /api/turn is the Worker saying "no model here" (no API key
    // in worker/.dev.vars). The app handles it; it is not a page error.
    if (m.type() === 'error' && !/status of (503|429)/.test(m.text())) report.errors.push(`[${tag}] ${m.text()}`)
  })
  page.on('pageerror', (e) => report.errors.push(`[${tag}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => report.failed.push(`[${tag}] ${r.url()} ${r.failure()?.errorText}`))
  return { ctx, page }
}

async function shot(page, name, full = true) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: OUT + name + '.png', fullPage: full })
}

async function passGate(page, year) {
  await page.goto(BASE + '/#/learn')
  await page.selectOption('select', '6')
  await page.fill('input[inputmode="numeric"]', String(year))
  await page.click('button[type=submit]')
  await page.waitForSelector('nav.tabs, .shell.kid')
}

// Gate
{
  const { ctx, page } = await fresh({ tag: 'gate' })
  await page.goto(BASE + '/')
  await shot(page, '01-gate')
  await ctx.close()
}

// Adult: every tab, a scene with two turns, a report, table mode, keyboard focus
{
  const { ctx, page } = await fresh({ tag: 'adult' })
  await passGate(page, 1990)
  await shot(page, '02-picker')
  await page.click('button[aria-label="Language"]')
  await shot(page, '03-picker-en')
  await page.click('button[aria-label="Language"]')

  await page.click('.scene-card >> nth=0')
  await page.waitForSelector('.composer, .offline-scene', { state: 'attached' })
  await shot(page, '04-scene')
  const ta = page.locator('textarea')
  if (await ta.count()) {
    await ta.fill('Hello, I need to refill my prescription.')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(6000)
    await shot(page, '05-scene-turn-1')
    if (await page.locator('textarea').count()) {
      await page.fill('textarea', 'It is for my mother.')
      await page.click('button[type=submit]')
      await page.waitForTimeout(6000)
      await shot(page, '06-scene-turn-2')
    }
  }

  await page.goto(BASE + '/#/card')
  await shot(page, '07-card')

  await page.goto(BASE + '/#/places')
  await page.waitForTimeout(4000)
  await shot(page, '08-places')
  const row = page.locator('.venue-row')
  report.notes.push('venue rows: ' + (await row.count()))
  if (await row.count()) {
    await row.first().click()
    await shot(page, '09-place')
    const easy = page.locator('button', { hasText: /^F[áa]cil$|^Easy$/ })
    if (await easy.count()) {
      await easy.first().click()
      await page.waitForTimeout(800)
      await shot(page, '10-place-reported')
    }
  }

  await page.goto(BASE + '/#/table')
  await shot(page, '11-table')
  await page.click('button.primary')
  await page.waitForTimeout(800)
  await shot(page, '12-table-running')

  await page.goto(BASE + '/#/ninos')
  await shot(page, '13-kids-tab')
  await page.goto(BASE + '/#/privacy')
  await shot(page, '14-privacy')

  await page.goto(BASE + '/#/learn')
  await page.waitForTimeout(300)
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
  await shot(page, '15-keyboard-focus', false)
  await ctx.close()
}

// Kid mode: watch every request it makes.
{
  const { ctx, page } = await fresh({ tag: 'kid' })
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(BASE)) report.kidNet.push('EXTERNAL ' + u)
    else if (/\/api\/|maplibre|\/pages\/(?!Ninos)|tutor\/client/.test(u)) report.kidNet.push('NETWORKED MODULE ' + u)
  })
  await passGate(page, 2018)
  await shot(page, '16-kid-street')
  await page.click('.storefront >> nth=0')
  await shot(page, '17-kid-scene')
  await page.click('.choice >> nth=0')
  await shot(page, '18-kid-choice')
  await page.reload()
  await page.waitForTimeout(800)
  await shot(page, '19-kid-reload')
  await ctx.close()
}

// Dark mode and desktop, once each.
{
  const { ctx, page } = await fresh({ tag: 'dark', dark: true })
  await passGate(page, 1990)
  await page.click('.scene-card >> nth=0')
  await shot(page, '20-dark-scene')
  await ctx.close()
}
{
  const { ctx, page } = await fresh({ tag: 'desktop', ctx: { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false } })
  await passGate(page, 1990)
  await shot(page, '21-desktop', false)
  await ctx.close()
}

await browser.close()
fs.writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
console.log(`\nScreenshots in ${OUT}`)
if (report.errors.length || report.kidNet.length) process.exitCode = 1
