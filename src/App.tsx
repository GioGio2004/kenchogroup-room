import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { startSmoothScroll } from '@/lib/motion'
import { NARRATION } from '@/lib/narration'
import { narrator } from '@/lib/narrator'
import { preload } from '@/lib/preload'
import { PHOTO_KEYS, PHOTOS } from '@/lib/scene-assets'
import { tracker } from '@/lib/tracker'
import Intro, { type Origin, type Path } from '@/scenes/opening/Intro'
import Kinetic from '@/scenes/opening/Kinetic'
import Sketchbook from '@/scenes/opening/Sketchbook'

// three.js is heavy: the room loads in its own chunk, fetched as the opening starts.
const loadRoom = () => import('@/scenes/room/Room')
const Room = lazy(loadRoom)

const ASSETS = [NARRATION.src, ...PHOTO_KEYS.map((k) => PHOTOS[k].src)]
/* The wordmark gets its moment even on a fast connection. */
const MIN_LOADER_MS = 3000

type Phase = 'loading' | 'ready' | 'leaving' | 'playing' | 'room'

/* Been through an opening before: a reload goes straight back to that room.
   ?intro in the address brings the opening back. */
const seen = tracker.get()
const RESUME = seen.introSeen && seen.path !== null && !new URLSearchParams(location.search).has('intro')

export default function App() {
  const [phase, setPhase] = useState<Phase>(RESUME ? 'room' : 'loading')
  const [progress, setProgress] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [sound, setSound] = useState(RESUME ? (seen.voice ?? true) : true)
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0, r: 160 })
  const [path, setPath] = useState<Path>(RESUME && seen.path ? seen.path : 'classic')
  const [kineticGone, setKineticGone] = useState(RESUME)
  const [introKey, setIntroKey] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => startSmoothScroll(), [])

  useEffect(() => {
    // resuming in the room: nothing to load for an opening
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
  const start = (withSound: boolean, from: Origin, chosen: Path) => {
    // the opening has the stage: no room line talks over it
    narrator.stop()
    setSound(withSound)
    setOrigin(from)
    setPath(chosen)
    tracker.set({ path: chosen })
    const a = audio.current
    if (withSound && a) {
      a.currentTime = 0
      void a.play().catch(() => setSound(false))
    }
    setPhase('leaving')
    void loadRoom()
  }

  // The opening is over: the room wipes in over it, then the opening goes.
  const toRoom = () => {
    tracker.set({ introSeen: true })
    setPhase('room')
    window.setTimeout(() => {
      audio.current?.pause()
      setKineticGone(true)
    }, 1400)
  }

  const replay = () => {
    audio.current?.pause()
    setKineticGone(false)
    setIntroKey((k) => k + 1)
    setPhase('loading')
    window.setTimeout(() => setPhase('ready'), 1800)
  }

  return (
    <main className="app">
      <audio ref={audio} src={urls[NARRATION.src] ?? NARRATION.src} preload="auto" />
      {(phase === 'leaving' || phase === 'playing' || phase === 'room') &&
        !kineticGone &&
        (path === 'sketch' ? (
          <Sketchbook audio={audio} sound={sound} origin={origin} urls={urls} onFinish={toRoom} />
        ) : (
          <Kinetic audio={audio} sound={sound} origin={origin} urls={urls} onFinish={toRoom} />
        ))}
      {phase === 'room' && (
        <Suspense
          fallback={
            // after a refresh the room's 3D chunk is still on its way: hold the wordmark
            <p className="resume-mark" data-look={path === 'sketch' ? 'sketch' : 'real'} aria-label="Kencho Group">
              KENCHO <span>GROUP</span>
            </p>
          }
        >
          <Room onReplay={replay} sound={sound} look={path === 'sketch' ? 'sketch' : 'real'} />
        </Suspense>
      )}
      {(phase === 'loading' || phase === 'ready' || phase === 'leaving') && (
        <Intro
          key={introKey}
          progress={progress}
          ready={phase !== 'loading'}
          leaving={phase === 'leaving'}
          onStart={start}
          onLeft={() => setPhase('playing')}
        />
      )}
    </main>
  )
}
