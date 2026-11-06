// What the page asks a phone's compositor and image cache to hold, moment by
// moment (start the dev server first):
//   node scripts/mem-probe.mjs            (the page, as a returning visitor)
//   PROBE_OPENING=1 node scripts/mem-probe.mjs   (the opening, then the page)
// An iPhone viewport at DPR 3. For every sample: the composited layers that
// draw content and what their backing stores would cost at full size
// (w x h x dpr^2 x 4 bytes, the iOS worst case: Chrome tiles, WebKit often
// doesn't), the decoded size of every image in the document, and the canvases.
import puppeteer from 'puppeteer-core'

const base = process.env.SHOTS_URL ?? 'http://localhost:5174'
const opening = !!process.env.PROBE_OPENING
const DPR = 3
const vp = { width: 390, height: 844, deviceScaleFactor: DPR, isMobile: true, hasTouch: true }
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: vp,
})
const page = await browser.newPage()
await page.setUserAgent(
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
)
if (!opening) {
  await page.evaluateOnNewDocument(() => {
    const now = Date.now()
    localStorage.setItem(
      'kencho-room-tracker',
      JSON.stringify({ version: 1, firstSeen: now, lastSeen: now, visits: 2, timeSpent: 0, path: 'classic', introSeen: true, voice: false, views: {}, angles: {}, finishes: {}, lastFinish: null, photos: {}, links: {} }),
    )
  })
}
const cdp = await page.createCDPSession()
await cdp.send('DOM.enable')
await cdp.send('LayerTree.enable')
let layers = []
cdp.on('LayerTree.layerTreeDidChange', (e) => (layers = e.layers ?? layers))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const MB = (b) => +(b / 1048576).toFixed(1)
const names = new Map()
async function nameOf(id) {
  if (!id) return '(no node)'
  if (names.has(id)) return names.get(id)
  let n = '?'
  try {
    const { node } = await cdp.send('DOM.describeNode', { backendNodeId: id })
    const a = node.attributes ?? []
    const get = (k) => a[a.indexOf(k) + 1]
    n = node.nodeName.toLowerCase() + (a.includes('id') ? '#' + get('id') : '') + (a.includes('class') ? '.' + get('class').trim().split(/\s+/).join('.') : '')
  } catch {}
  names.set(id, n)
  return n
}

const rows = []
async function sample(label) {
  // (headless Chrome only sends the tree when the domain is switched on)
  const fresh = new Promise((r) => cdp.once('LayerTree.layerTreeDidChange', r))
  await cdp.send('LayerTree.disable')
  await cdp.send('LayerTree.enable')
  await Promise.race([fresh, sleep(400)])
  const drawn = layers.filter((l) => l.drawsContent && !l.invisible)
  let bytes = 0
  const big = []
  for (const l of drawn) {
    const b = l.width * l.height * DPR * DPR * 4
    bytes += b
    if (b > 4 * 1048576) big.push({ node: await nameOf(l.backendNodeId), css: `${Math.round(l.width)}x${Math.round(l.height)}`, mb: MB(b) })
  }
  big.sort((a, b) => b.mb - a.mb)
  const doc = await page.evaluate(() => {
    const seen = new Set()
    let img = 0
    for (const el of document.images) {
      if (!el.complete || !el.naturalWidth || seen.has(el.currentSrc)) continue
      seen.add(el.currentSrc)
      img += el.naturalWidth * el.naturalHeight * 4
    }
    const canvases = [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`)
    return { img, images: seen.size, canvases, nodes: document.getElementsByTagName('*').length, y: Math.round(scrollY) }
  })
  const heap = (await page.metrics()).JSHeapUsedSize
  const row = { label, y: doc.y, layers: drawn.length, layerMB: MB(bytes), imgMB: MB(doc.img), images: doc.images, canvases: doc.canvases.join(' '), heapMB: MB(heap), nodes: doc.nodes, big: big.slice(0, 6) }
  rows.push(row)
  console.log(JSON.stringify(row))
}

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })

if (opening) {
  await page.waitForSelector('.intro-orb', { timeout: 60000 })
  await sleep(4000)
  await sample('intro ready')
  // start without sound: the clock drives the timeline
  await page.click('.intro-quiet')
  for (const t of [0.5, 2, 5, 8, 11, 14, 17, 20, 23, 26, 29]) {
    await page.waitForFunction((t) => window.__kinetic && window.__kinetic.time() >= t, { timeout: 60000 }, t).catch(() => {})
    await sample(`opening t=${t}`)
  }
}

// the page arrives: the burst of colour, then the hero
await page.waitForSelector('.page', { timeout: 90000 })
for (let i = 0; i < 16; i++) {
  await sample(`arrival +${i * 130}ms`)
}
await sleep(1500)
await sample('hero')

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
for (const [id, f] of [['what', 0.5], ['pieces', 0.1], ['pieces', 0.6], ['finishes', 0.3], ['outro', 0.2]]) {
  await toId(id, f)
  await sleep(1200)
  await sample(`${id} ${f}`)
}
await to('max')
await sleep(6000)
await sample('room footer')
await to(0)
await sleep(1500)
await sample('back at the top')

const worst = rows.reduce((a, b) => (b.layerMB + b.imgMB > a.layerMB + a.imgMB ? b : a))
console.log('\nWORST', JSON.stringify(worst, null, 1))
await browser.close()
