// End-to-end check of the spoken loop in a real Chrome: a recorded sentence is
// fed in as the microphone, and the script reports whether a transcript came
// back, whether the partner replied, and whether audio actually played.
//   npm run voicecheck -- path/to/sentence.wav   (dev server on 5173 and the Worker on 8787)
import { chromium } from 'playwright-core'
import path from 'node:path'

const BASE = process.env.WALK_BASE ?? 'http://localhost:5173'
const mic = path.resolve(process.argv[2])
const out = path.resolve('.walk') + path.sep

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${mic}%noloop`],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-US', permissions: ['microphone'] })
const page = await ctx.newPage()
const api = []
page.on('response', async (r) => {
  const u = new URL(r.url())
  if (!u.pathname.startsWith('/api/')) return
  let size = 0
  try {
    size = (await r.body()).length
  } catch {}
  api.push(`${u.pathname} ${r.status()} ${r.headers()['content-type'] ?? ''} ${size}B`)
})
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => {
  window.__plays = []
  const orig = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () {
    const el = this
    const p = orig.apply(el, arguments)
    p.then(
      () => window.__plays.push({ ok: true, seconds: Number.isFinite(el.duration) ? +el.duration.toFixed(2) : null, rate: el.playbackRate }),
      (e) => window.__plays.push({ ok: false, err: String(e) }),
    )
    return p
  }
})

await page.goto(BASE + '/')
await page.click('button[lang="es"]')
await page.selectOption('select', '6')
await page.fill('input[inputmode="numeric"]', '1990')
await page.click('button[type=submit]')
await page.waitForSelector('.scene-card')
await page.click('.scene-card >> nth=0')
await page.waitForSelector('.composer')

// 1. A typed turn: the reply must be read aloud.
await page.fill('textarea', 'Hello, I am here to pick up a prescription for my mother.')
await page.keyboard.press('Enter')
await page.waitForSelector('.chat li.assistant:not(.pending)', { timeout: 30000 })
const spokeWhileReading = await page.waitForSelector('.chat button.speaking', { timeout: 15000 }).then(() => true, () => false)
await page.waitForTimeout(6000)
const reply1 = await page.locator('.chat li.assistant:not(.pending) .line').last().innerText()
const briefOpen = await page.locator('details.brief').evaluate((d) => d.open)
await page.screenshot({ path: out + '30-voice-typed.png', fullPage: false })

// 2. A spoken turn: the fake mic says a sentence, then goes quiet.
await page.click('.talk')
const liveStatus = []
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500)
  const s = await page.locator('.talk-status').innerText().catch(() => '')
  if (s && liveStatus[liveStatus.length - 1] !== s) liveStatus.push(s)
  if ((await page.locator('.chat li.user').count()) >= 2) break
}
const heard = (await page.locator('.chat li.user').count()) >= 2 ? await page.locator('.chat li.user .line').last().innerText() : null
const coach = await page.locator('.coach').innerText().catch(() => null)
await page.waitForSelector('.chat li.assistant:not(.pending) >> nth=1', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(7000)
const reply2 = (await page.locator('.chat li.assistant:not(.pending)').count()) >= 2 ? await page.locator('.chat li.assistant:not(.pending) .line').last().innerText() : null
await page.screenshot({ path: out + '31-voice-spoken.png', fullPage: false })

const plays = await page.evaluate(() => window.__plays)
console.log(JSON.stringify({ reply1, spokeWhileReading, briefOpenAfterFirstReply: briefOpen, liveStatus, heard, coach, reply2, plays, api, errors }, null, 2))
await browser.close()
