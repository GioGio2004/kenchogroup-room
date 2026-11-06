import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { startSmoothScroll } from '@/lib/motion'
import { NARRATION } from '@/lib/narration'
import { narrator } from '@/lib/narrator'
import { preload } from '@/lib/preload'
import { PHOTO_KEYS, PHOTOS } from '@/lib/scene-assets'
import { tracker } from '@/lib/tracker'
import Intro, { type Origin } from '@/scenes/opening/Intro'
import Kinetic from '@/scenes/opening/Kinetic'

// The page (and, inside it, the room's three.js) come in their own chunks,
// fetched while the opening plays.
const loadPage = () => import('@/page/Page')
const Page = lazy(loadPage)

const ASSETS = [NARRATION.src, ...PHOTO_KEYS.map((k) => PHOTOS[k].src)]
/* The wordmark gets its moment even on a fast connection. */
const MIN_LOADER_MS = 3000

type Phase = 'loading' | 'ready' | 'leaving' | 'playing' | 'page'

/* Been through the opening before: a reload goes straight to the page.
   ?intro in the address brings the opening back. */
const seen = tracker.get()
const RESUME = seen.introSeen && !new URLSearchParams(location.search).has('intro')

/*
 * The opening (the narrator and the kinetic type, on cream with an orange
 * wordmark), then the page in colour, with the hand-drawn room at the bottom.
 */
export default function App() {
  const [phase, setPhase] = useState<Phase>(RESUME ? 'page' : 'loading')
  const [progress, setProgress] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [sound, setSound] = useState(RESUME ? (seen.voice ?? true) : true)
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0, r: 160 })
  const [kineticGone, setKineticGone] = useState(RESUME)
  const [introKey, setIntroKey] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => startSmoothScroll(), [])

  useEffect(() => {
    // resuming on the page: nothing to load for an opening
    if (RESUME) return
    const run = { alive: true }
    const started = performance.now()
    void preload(ASSETS, (p) => run.alive && setProgress(p)).then(async (all) => {
      const wait = MIN_LOADER_MS - (performance.now() - started)
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      if (!run.alive) return
      setUrls(all)
      setProgress(1)
      setPhase('ready')
    })
    return () => {
      run.alive = false
    }
  }, [])

  // Audio must start inside the click itself, or browsers block it.
  const start = (withSound: boolean, from: Origin) => {
    // the opening has the stage: no other line talks over it
    narrator.stop()
    setSound(withSound)
    setOrigin(from)
    tracker.set({ path: 'classic' })
    const a = audio.current
    if (withSound && a) {
      a.currentTime = 0
      void a.play().catch(() => setSound(false))
    }
    setPhase('leaving')
    void loadPage()
  }

  // The opening is over: the page bursts in over it, then the opening goes.
  const toPage = () => {
    tracker.set({ introSeen: true })
    setPhase('page')
    window.setTimeout(() => {
      audio.current?.pause()
      setKineticGone(true)
    }, 1400)
  }

  const replay = () => {
    audio.current?.pause()
    narrator.stop()
    window.scrollTo(0, 0)
    setKineticGone(false)
    setIntroKey((k) => k + 1)
    setPhase('loading')
    window.setTimeout(() => setPhase('ready'), 1800)
  }

  return (
    <main className="app" data-phase={phase}>
      <audio ref={audio} src={urls[NARRATION.src] ?? NARRATION.src} preload="auto" />
      {(phase === 'leaving' || phase === 'playing' || phase === 'page') && !kineticGone && (
        <Kinetic audio={audio} sound={sound} origin={origin} urls={urls} onFinish={toPage} />
      )}
      {phase === 'page' && (
        <Suspense
          fallback={
            // after a refresh the page's chunk is still on its way: hold the wordmark
            <p className="resume-mark" aria-label="Kencho Group">
              KENCHO <span>GROUP</span>
            </p>
          }
        >
          <Page sound={sound} onSound={setSound} onReplay={replay} />
        </Suspense>
      )}
      {(phase === 'loading' || phase === 'ready' || phase === 'leaving') && (
        <Intro key={introKey} progress={progress} ready={phase !== 'loading'} leaving={phase === 'leaving'} onStart={start} onLeft={() => setPhase('playing')} />
      )}
    </main>
  )
}
