import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'

interface IntroProps {
  progress: number
  ready: boolean
  leaving: boolean
  onStart: (sound: boolean, radius: number) => void
  onLeft: () => void
}

const NAME = 'KENCHO'
/* The counter climbs at least over this long, even on an instant load. */
const COUNT_MS = 2600

/*
 * The loading scene: white, black type. KENCHO rises letter by letter,
 * GROUP settles under it, a hairline fills with load progress; then the
 * wordmark steps up and one big Start button takes the centre.
 */
export default function Intro({ progress, ready, leaving, onStart, onLeft }: IntroProps) {
  const root = useRef<HTMLElement>(null)
  const orb = useRef<HTMLButtonElement>(null)
  const reduced = typeof window !== 'undefined' && prefersReducedMotion()

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const began = performance.now()
    const id = window.setInterval(() => {
      const t = (performance.now() - began) / COUNT_MS
      setElapsed(Math.min(1, t))
      if (t >= 1) window.clearInterval(id)
    }, 40)
    return () => window.clearInterval(id)
  }, [])
  const shown = Math.min(progress, elapsed)
  const pct = Math.round(shown * 100)

  useGSAP(
    () => {
      if (reduced) {
        gsap.from('.intro-mark', { opacity: 0, duration: 0.3 })
        return
      }
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.intro-letter', { yPercent: 112, duration: 1.3, stagger: 0.075 }, 0.15)
        .from('.intro-group', { opacity: 0, letterSpacing: '0.9em', duration: 1.6 }, 0.55)
        .from('.intro-meter', { opacity: 0, y: 10, duration: 0.9 }, 0.9)
        .from('.intro-chrome > *', { opacity: 0, duration: 0.9 }, 1)
    },
    { scope: root },
  )

  // Ready: the wordmark steps up, the meter clears, the Start button arrives.
  useGSAP(
    () => {
      if (!ready) return
      const lift = -Math.min(window.innerHeight * 0.33, 300)
      gsap
        .timeline()
        .to('.intro-meter', { opacity: 0, y: -8, duration: 0.5, ease: 'power2.in' }, 0)
        .to('.intro-mark', { y: reduced ? 0 : lift, scale: 0.42, duration: 1.2, ease: 'expo.inOut' }, 0.2)
        .fromTo('.intro-orb', { scale: 0 }, { scale: 1, duration: 1.1, ease: 'expo.out' }, 0.75)
        .fromTo('.intro-quiet', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 1.1)
    },
    { scope: root, dependencies: [ready] },
  )

  // Desktop: the button leans toward the pointer.
  useGSAP(
    () => {
      if (!ready || reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      const ox = gsap.quickTo(orb.current, 'x', { duration: 0.8, ease: 'power3.out' })
      const oy = gsap.quickTo(orb.current, 'y', { duration: 0.8, ease: 'power3.out' })
      const move = (e: PointerEvent) => {
        const r = orb.current?.getBoundingClientRect()
        if (!r) return
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const near = Math.hypot(dx, dy) < r.width
        ox(near ? dx * 0.16 : 0)
        oy(near ? dy * 0.16 : 0)
      }
      window.addEventListener('pointermove', move)
      return () => window.removeEventListener('pointermove', move)
    },
    { scope: root, dependencies: [ready] },
  )

  // Leaving: everything but the button clears while the scene floods out of it.
  useGSAP(
    () => {
      if (!leaving) return
      gsap
        .timeline({ onComplete: onLeft })
        .to('.intro-mark, .intro-quiet, .intro-chrome', { opacity: 0, duration: 0.35, ease: 'power2.in' }, 0)
        .to({}, { duration: 0.5 })
    },
    { scope: root, dependencies: [leaving] },
  )

  const start = (sound: boolean) => {
    const r = orb.current?.getBoundingClientRect()
    onStart(sound, r ? r.width / 2 : 160)
  }

  return (
    <section ref={root} className="intro" aria-label="Kencho Group">
      <div className="intro-stage">
        <h1 className="intro-mark">
          <span className="intro-name" aria-hidden="true">
            {NAME.split('').map((ch, i) => (
              <span key={i} className="intro-mask">
                <span className="intro-letter">{ch}</span>
              </span>
            ))}
          </span>
          <span className="intro-group" aria-hidden="true">
            GROUP
          </span>
          <span className="sr-only">Kencho Group</span>
        </h1>

        <div className="intro-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className="intro-count">{String(pct).padStart(3, '0')}</span>
          <span className="intro-bar">
            <span style={{ transform: `scaleX(${shown})` }} />
          </span>
        </div>
      </div>

      <div className="intro-center" inert={!ready || leaving}>
        <button ref={orb} type="button" className="intro-orb" onClick={() => start(true)}>
          <svg className="intro-orb-ring" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <path id="intro-ring-path" d="M100,100 m-84,0 a84,84 0 1,1 168,0 a84,84 0 1,1 -168,0" />
            </defs>
            <text>
              {/* textLength fills the ring exactly, so the phrase never overlaps itself */}
              <textPath href="#intro-ring-path" textLength="520" lengthAdjust="spacing">
                KENCHO GROUP · BEST WITH SOUND · TBILISI ·
              </textPath>
            </text>
          </svg>
          <span className="intro-orb-label">Start</span>
        </button>
        <button type="button" className="text-link intro-quiet" onClick={() => start(false)}>
          Continue without sound
        </button>
      </div>

      <div className="intro-chrome" aria-hidden="true">
        <span>Custom furniture · Tbilisi</span>
        <span>room.kenchogroup.ge</span>
      </div>
    </section>
  )
}
