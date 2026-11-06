// Frames of the opening at exact narration times (dev server running; the
// dev build exposes the opening's timeline as window.__kinetic):
//   TIMES='[9.3,13.6,16.6]' npm run opening:frames      (PHONE=1 for a phone)
import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
fs.mkdirSync('.shots/kin', { recursive: true })
const phone = !!process.env.PHONE
const vp = phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1600, height: 1000 }
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu'], defaultViewport: vp })
const p = await b.newPage()
const logs = []
p.on('pageerror', (e) => logs.push(e.message))
p.on('console', (m) => m.type() === 'error' && logs.push(m.text()))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await p.goto('http://localhost:5174/?intro', { waitUntil: 'networkidle2' })
await sleep(5200)
await p.click('.intro-quiet')
await sleep(1500)
const times = JSON.parse(process.env.TIMES)
for (const t of times) {
  await p.evaluate((t) => { window.__kinetic.pause(); window.__kinetic.time(t, false) }, t)
  await sleep(250)
  await p.screenshot({ path: `.shots/kin/${phone ? 'p' : 'd'}-${String(t).replace('.', '_')}.png` })
}
console.log(JSON.stringify({ logs }))
await b.close()
