// Renders public/icons/icon.svg to the PNG sizes iOS and Android actually use.
// Safari ignores an SVG apple-touch-icon, so without these the installed app
// gets a blank tile. Uses the installed Chrome; no browser download.
//
//   npm run icons
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const svg = fs.readFileSync(path.resolve('public/icons/icon.svg'), 'utf8')
const out = path.resolve('public/icons')

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true })
    } catch {}
  }
  throw new Error('No Chrome or Edge found.')
}

const browser = await launch()
const page = await browser.newPage()

// `pad` is the safe-zone inset for maskable icons: Android crops up to 10% per
// side, so the artwork is scaled to 80% on a solid background.
async function render(file, size, pad = 0) {
  const inner = Math.round(size * (1 - 2 * pad))
  const off = Math.round(size * pad)
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<body style="margin:0;background:#24476B;width:${size}px;height:${size}px;overflow:hidden">
       <div style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px">${svg}</div>
     </body>`,
  )
  await page.locator('svg').first().evaluate((el, s) => {
    el.setAttribute('width', String(s))
    el.setAttribute('height', String(s))
  }, inner)
  await page.screenshot({ path: path.join(out, file), clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false })
  console.log(file, size)
}

await render('apple-touch-icon.png', 180)
await render('icon-192.png', 192)
await render('icon-512.png', 512)
await render('icon-maskable-512.png', 512, 0.1)
await browser.close()
