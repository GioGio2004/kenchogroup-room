// Interaction checks for the page on the real GPU (start the dev server first):
//   node scripts/page-check.mjs        (SHOTS_PHONE=1 for a phone)
// Frame rate through the page, a finish picked in the deck reaching the room,
// the room uncovered and drawn, the contact card from the rail and from the
// room's TV, and the header's jump to the room.
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.SHOTS_URL ?? 'http://localhost:5174'
const out = process.env.SHOTS_OUT ?? '.shots/check'
const phone = !!process.env.SHOTS_PHONE
fs.mkdirSync(out, { recursive: true })
const vp = phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1600, height: 1000 }
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${vp.width},${vp.height}`],
  defaultViewport: vp,
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))
await page.evaluateOnNewDocument((SIDE_PATH) => {
  const now = Date.now()
  localStorage.setItem(
    'kencho-room-tracker',
    JSON.stringify({ version: 1, firstSeen: now, lastSeen: now, visits: 1, timeSpent: 0, path: SIDE_PATH, introSeen: true, voice: false, views: {}, angles: {}, finishes: {}, lastFinish: null, photos: {}, links: {} }),
  )
  localStorage.removeItem('kencho-room-finish-sketch')
}, 'classic')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tag = phone ? 'p' : 'd'
const shot = (n) => page.screenshot({ path: path.join(out, `${tag}-${n}.png`) })
const results = {}
const to = (y) => page.evaluate((y) => window.__lenis.scrollTo(y === 'max' ? document.documentElement.scrollHeight : y, { immediate: true, force: true }), y)
const toId = (id, f = 0) =>
  page.evaluate(
    (id, f) => {
      const el = document.getElementById(id)
      const box = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el
      window.__lenis.scrollTo(box.getBoundingClientRect().top + scrollY + f * box.offsetHeight, { immediate: true, force: true })
    },
    id,
    f,
  )

await page.goto(`${base}/`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.page, .mono')
await sleep(3500)

// ---- frame rate: a steady scroll from top to bottom --------------------------
results.fps = await page.evaluate(async () => {
  const end = document.documentElement.scrollHeight - innerHeight
  const frames = []
  let last = performance.now()
  let y = 0
  return new Promise((res) => {
    const step = (t) => {
      frames.push(t - last)
      last = t
      y += end / 700
      window.__lenis.scrollTo(y, { immediate: true, force: true })
      if (y < end) requestAnimationFrame(step)
      else {
        frames.sort((a, b) => a - b)
        const avg = frames.reduce((a, b) => a + b, 0) / frames.length
        res({ frames: frames.length, avgFps: +(1000 / avg).toFixed(1), median: +frames[frames.length >> 1].toFixed(1), p95ms: +frames[Math.floor(frames.length * 0.95)].toFixed(1) })
      }
    }
    requestAnimationFrame(step)
  })
})
await to(0)
await sleep(800)

// ---- palettes: pick Forest green on the stripe wall ---------------------------------
await toId('finishes', 0.3)
await sleep(1800)
const cols = await page.$$('.pal-col')
await cols[1].click()
await sleep(1500)
results.finish = await page.evaluate(() => ({
  stored: localStorage.getItem('kencho-room-finish-sketch'),
  checked: document.querySelector('.pal-col[aria-checked="true"]')?.getAttribute('aria-label'),
  open: document.querySelector('.pal-col[data-open]')?.getAttribute('aria-label'),
}))
await shot('finish-forest')

// ---- the room, uncovered ---------------------------------------------------------------
await to('max')
await sleep(7500)
// (the footer is the room alone: full screen, the navbar out of its way)
results.room = await page.evaluate(() => ({
  canvas: !!document.querySelector('.rf canvas'),
  view: document.querySelector('.room')?.dataset.view,
  navbarHidden: getComputedStyle(document.querySelector('.nav-bar')).transform !== 'none',
  // the room's Contacts (the TV) books a meeting on the main site
  contacts: [...document.querySelectorAll('.room .callout')].find((el) => /Contacts/.test(el.textContent ?? ''))?.getAttribute('href') ?? null,
}))
await shot('room-footer')

// ---- the navbar's menu: open it, then jump to the room ----------------------------------
await to(0)
await sleep(1200)
await page.click('.nav-actions button')
await sleep(1200)
results.menu = await page.evaluate(() => ({
  open: document.querySelector('.nav-panel')?.hasAttribute('data-on'),
  items: [...document.querySelectorAll('.panel-item .panel-label')].map((el) => el.textContent?.trim()),
}))
await shot('menu')
await page.evaluate(() => [...document.querySelectorAll('.panel-item')].find((b) => /The room/.test(b.textContent ?? ''))?.click())
await sleep(4200)
results.jump = await page.evaluate(() => ({ y: Math.round(scrollY), max: document.documentElement.scrollHeight - innerHeight }))
console.log(JSON.stringify({ results, logs: logs.slice(0, 30) }, null, 1))
await browser.close()
