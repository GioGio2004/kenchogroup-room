// Headless screenshots of the page on the real GPU (start the dev server first):
//   node scripts/page-shots.mjs
// SHOTS_PHONE=1 for 390×844 @2×, SHOTS_REDUCED=1 for reduced motion,
// SHOTS_AT='[["pieces",0.5]]' for chosen points (section id, fraction),
// SHOTS_INTRO=1 to play through the opening instead of skipping it.
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const base = process.env.SHOTS_URL ?? 'http://localhost:5174'
const out = process.env.SHOTS_OUT ?? '.shots/page'
const phone = !!process.env.SHOTS_PHONE
fs.mkdirSync(out, { recursive: true })
const vp = phone
  ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { width: Number(process.env.SHOTS_W ?? 1600), height: Number(process.env.SHOTS_H ?? 1000) }
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${vp.width},${vp.height}`, '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: vp,
})
const page = await browser.newPage()
if (process.env.SHOTS_REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
const logs = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))
if (!process.env.SHOTS_INTRO) {
  // been here before: straight to the page, sound off
  await page.evaluateOnNewDocument((SIDE_PATH) => {
    const now = Date.now()
    localStorage.setItem(
      'kencho-room-tracker',
      JSON.stringify({ version: 1, firstSeen: now, lastSeen: now, visits: 1, timeSpent: 0, path: SIDE_PATH, introSeen: true, voice: false, views: {}, angles: {}, finishes: {}, lastFinish: null, photos: {}, links: {} }),
    )
  }, 'classic')
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tag = phone ? 'p' : 'd'

await page.goto(`${base}/${process.env.SHOTS_Q ?? ''}`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('.page, .mono', { timeout: 30000 })
await sleep(3200)

const go = (id, f) =>
  page.evaluate(
    (id, f) => {
      const lenis = window.__lenis
      const to = (y) => (lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y))
      if (id === 'end') return to(document.documentElement.scrollHeight)
      const el = document.getElementById(id)
      if (!el) return
      const box = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el
      const top = box.getBoundingClientRect().top + window.scrollY
      const span = box.offsetHeight - window.innerHeight
      to(top + f * (span > 0 && box !== el ? span : box.offsetHeight))
    },
    id,
    f,
  )

const points = process.env.SHOTS_AT
  ? JSON.parse(process.env.SHOTS_AT)
  : [
      ['top', 0],
      ['top', 0.6],
      ['pieces', 0],
      ['pieces', 0.3],
      ['pieces', 0.75],
      ['finishes', 0.1],
      ['outro', 0],
      ['outro', 0.6],
      ['end', 0],
    ]
await page.screenshot({ path: path.join(out, `${tag}-00-hero.png`) })
let i = 1
for (const [id, f] of points) {
  await go(id, f)
  await sleep(id === 'end' ? 7000 : 1600)
  await page.screenshot({ path: path.join(out, `${tag}-${String(i++).padStart(2, '0')}-${id}-${f}.png`) })
}
console.log(JSON.stringify({ shots: i, logs: logs.slice(0, 30) }, null, 1))
await browser.close()
