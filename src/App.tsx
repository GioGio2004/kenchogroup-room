import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { startSmoothScroll } from '@/lib/motion'
import { NARRATION } from '@/lib/narration'
import { preload } from '@/lib/preload'
import { PHOTO_KEYS, PHOTOS } from '@/lib/scene-assets'
import Intro from '@/scenes/opening/Intro'
import Kinetic from '@/scenes/opening/Kinetic'

// three.js is heavy: the room loads in its own chunk, fetched as the opening starts.
const loadRoom = () => import('@/scenes/room/Room')
const Room = lazy(loadRoom)

const ASSETS = [NARRATION.src, ...PHOTO_KEYS.map((k) => PHOTOS[k].src)]
/* The wordmark gets its moment even on a fast connection. */
const MIN_LOADER_MS = 3000

type Phase = 'loading' | 'ready' | 'leaving' | 'playing' | 'room'

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [sound, setSound] = useState(true)
  const [revealFrom, setRevealFrom] = useState(160)
  const [kineticGone, setKineticGone] = useState(false)
  const [introKey, setIntroKey] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)

  useEffect(() => startSmoothScroll(), [])

  useEffect(() => {
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
  const start = (withSound: boolean, radius: number) => {
    setSound(withSound)
    setRevealFrom(radius)
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
      {(phase === 'leaving' || phase === 'playing' || phase === 'room') && !kineticGone && (
        <Kinetic audio={audio} sound={sound} revealFrom={revealFrom} urls={urls} onFinish={toRoom} />
      )}
      {phase === 'room' && (
        <Suspense fallback={null}>
          <Room onReplay={replay} />
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
