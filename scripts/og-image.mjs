// The sharing card (public/og.jpg, 1200 x 630) and the app icons, drawn in
// Chrome from the page's own type, colours and hero photograph:
//   node scripts/og-image.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = process.cwd()
const work = path.join(root, '.shots', 'og')
fs.mkdirSync(work, { recursive: true })
const url = (p) => pathToFileURL(path.join(root, p)).href
const inter = url('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')
const hero = url('public/media/photos/walnut-island.webp')

const PAPER = '#f3eee3'
const INK = '#1f1c18'
const TERRA = '#c5603d'
const DOTS = ['#c5603d', '#dca443', '#8e9b85', '#3e5848', '#e7ab9a']

const base = `
  @font-face { font-family: Inter; src: url(${inter}) format('woff2'); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; }
  body { font-family: Inter, sans-serif; color: ${INK}; background: ${PAPER}; -webkit-font-smoothing: antialiased; }
`

const og = `<!doctype html><meta charset="utf-8"><style>${base}
  body { position: relative; overflow: hidden; }
  .mark { position: absolute; left: 72px; top: 60px; display: flex; align-items: baseline; gap: 10px; }
  .mark b { font-weight: 700; font-size: 26px; letter-spacing: -0.02em; }
  .mark span { font-weight: 500; font-size: 12px; letter-spacing: 0.24em; }
  h1 { position: absolute; left: 68px; top: 150px; font-weight: 600; font-size: 98px; line-height: 0.94; letter-spacing: -0.05em; }
  h1 i { font-style: normal; color: ${TERRA}; }
  p { position: absolute; left: 72px; top: 462px; width: 560px; font-size: 25px; line-height: 1.38; letter-spacing: -0.01em; color: rgb(31 28 24 / 0.72); }
  .foot { position: absolute; left: 72px; bottom: 54px; display: flex; align-items: center; gap: 22px; font-size: 19px; font-weight: 500; letter-spacing: -0.005em; }
  .dots { display: flex; gap: 7px; }
  .dots i { width: 20px; height: 20px; border-radius: 50%; }
  .arch { position: absolute; right: 84px; bottom: 0; width: 404px; height: 546px; border-radius: 999px 999px 0 0; overflow: hidden; background: ${INK}; }
  .arch img { width: 100%; height: 100%; object-fit: cover; object-position: 42% 50%; }
</style>
<div class="mark"><b>KENCHO</b><span>GROUP</span></div>
<h1>Furniture<br>drawn for<br><i>your walls.</i></h1>
<p>Kitchens, wardrobes and whole walls of wood, made to measure in our own workshop in Tbilisi.</p>
<div class="foot"><div class="dots">${DOTS.map((c) => `<i style="background:${c}"></i>`).join('')}</div>room.kenchogroup.ge</div>
<div class="arch"><img src="${hero}" alt=""></div>`

// The icon: the orange Start button with a cream K, full bleed (iOS and
// Android round the corners themselves).
const icon = `<!doctype html><meta charset="utf-8"><style>${base}
  body { display: grid; place-items: center; background: ${TERRA}; color: ${PAPER}; }
  b { font-weight: 700; font-size: 58vw; letter-spacing: -0.04em; line-height: 1; translate: -1% -2%; }
</style><b>K</b>`

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--allow-file-access-from-files'],
})
const page = await browser.newPage()
async function render(html, name, w, h, out, type = 'png') {
  const file = path.join(work, `${name}.html`)
  fs.writeFileSync(file, html)
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: out, type, ...(type === 'jpeg' ? { quality: 88 } : {}) })
  console.log(out, fs.statSync(out).size, 'bytes')
}

await render(og, 'og', 1200, 630, path.join(root, 'public', 'og.jpg'), 'jpeg')
for (const [size, file] of [
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
]) {
  await render(icon, `icon-${size}`, size, size, path.join(root, 'public', file))
}
await browser.close()
