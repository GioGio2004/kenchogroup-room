import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'

export type Path = 'classic' | 'sketch'
/** where the chosen Start button sits, so the next scene can grow out of it */
export interface Origin {
  x: number
  y: number
  r: number
}

interface IntroProps {
  progress: number
  ready: boolean
  leaving: boolean
  onStart: (sound: boolean, origin: Origin, path: Path) => void
  onLeft: () => void
}

const NAME = 'KENCHO'
/* The counter climbs at least over this long, even on an instant load. */
const COUNT_MS = 2600

/*
 * The loading scene: white, black type. KENCHO rises letter by letter,
 * GROUP settles under it, a hairline fills with load progress; then the
 * wordmark steps up and the screen splits in two: the original black and
 * white opening on the left, the retro sketchbook on the right.
 */
export default function Intro({ progress, ready, leaving, onStart, onLeft }: IntroProps) {
  const root = useRef<HTMLElement>(null)
  const orbs = useRef<Record<Path, HTMLButtonElement | null>>({ classic: null, sketch: null })
  const [chosen, setChosen] = useState<Path | null>(null)
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

  // Ready: the wordmark steps up, the paper half wipes in, two Starts arrive.
  useGSAP(
    () => {
      if (!ready) return
      const lift = -(window.innerHeight / 2 - Math.min(118, window.innerHeight * 0.13))
      const portrait = window.innerWidth < window.innerHeight
      gsap
        .timeline()
        .to('.intro-meter', { opacity: 0, y: -8, duration: 0.5, ease: 'power2.in' }, 0)
        .to('.intro-mark', { y: reduced ? 0 : lift, scale: portrait ? 0.38 : 0.3, duration: 1.2, ease: 'expo.inOut' }, 0.2)
        .fromTo(
          '.intro-half[data-path="sketch"]',
          { clipPath: portrait ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 0% 100%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: reduced ? 0.01 : 1.1, ease: 'expo.inOut' },
          0.35,
        )
        .fromTo('.intro-divider', { scaleY: 0 }, { scaleY: 1, duration: 0.9, ease: 'expo.inOut' }, 0.6)
        .fromTo('.intro-orb', { scale: 0 }, { scale: 1, duration: 1.1, ease: 'expo.out', stagger: 0.14 }, 0.85)
        .fromTo('.intro-sketch-stroke', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', stagger: 0.12 }, 1.0)
        .fromTo('.intro-path-meta, .intro-quiet, .intro-or', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 }, 1.2)
    },
    { scope: root, dependencies: [ready] },
  )

  // Desktop: each button leans toward the pointer.
  useGSAP(
    () => {
      if (!ready || reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      const lean = (['classic', 'sketch'] as Path[]).map((p) => {
        const el = orbs.current[p]
        return { el, x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }) }
      })
      const move = (e: PointerEvent) => {
        for (const o of lean) {
          const r = o.el?.getBoundingClientRect()
          if (!r) continue
          const dx = e.clientX - (r.left + r.width / 2)
          const dy = e.clientY - (r.top + r.height / 2)
          const near = Math.hypot(dx, dy) < r.width
          o.x(near ? dx * 0.16 : 0)
          o.y(near ? dy * 0.16 : 0)
        }
      }
      window.addEventListener('pointermove', move)
      return () => window.removeEventListener('pointermove', move)
    },
    { scope: root, dependencies: [ready] },
  )

  // Leaving: everything but the chosen button clears while its scene floods out of it.
  useGSAP(
    () => {
      if (!leaving) return
      gsap
        .timeline({ onComplete: onLeft })
        .to(
          '.intro-mark, .intro-quiet, .intro-chrome, .intro-path-meta, .intro-or, .intro-divider, .intro-half:not([data-chosen]) .intro-orb',
          { opacity: 0, duration: 0.35, ease: 'power2.in' },
          0,
        )
        .to({}, { duration: 0.5 })
    },
    { scope: root, dependencies: [leaving] },
  )

  const start = (path: Path, sound: boolean) => {
    const r = orbs.current[path]?.getBoundingClientRect()
    setChosen(path)
    onStart(sound, r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 } : { x: innerWidth / 2, y: innerHeight / 2, r: 160 }, path)
  }

  return (
    <section ref={root} className="intro" data-ready={ready || undefined} aria-label="Kencho Group">
      <div className="intro-halves" inert={!ready || leaving}>
        {/* the original: white, black type, a black Start */}
        <div className="intro-half" data-path="classic" data-chosen={chosen === 'classic' || undefined}>
          <p className="intro-path-meta">
            <span>01</span> The original <em>Black &amp; white, kinetic type</em>
          </p>
          <button
            ref={(el) => {
              orbs.current.classic = el
            }}
            type="button"
            className="intro-orb"
            onClick={() => start('classic', true)}
          >
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
          <button type="button" className="text-link intro-quiet" onClick={() => start('classic', false)}>
            Continue without sound
          </button>
        </div>

        {/* the sketchbook: paper, ink and colour, the room's retro world */}
        <div className="intro-half intro-half--sketch" data-path="sketch" data-chosen={chosen === 'sketch' || undefined}>
          <p className="intro-path-meta">
            <span>02</span> The sketchbook <em>Retro, drawn, in colour</em>
          </p>
          <button
            ref={(el) => {
              orbs.current.sketch = el
            }}
            type="button"
            className="intro-orb intro-orb--sketch"
            onClick={() => start('sketch', true)}
          >
            <svg className="intro-sketch-art" viewBox="0 0 200 200" aria-hidden="true">
              {/* a wash of colour, then two hand-drawn rings that overshoot */}
              <circle className="intro-sketch-wash" cx="101" cy="99" r="88" />
              <path className="intro-sketch-stroke" pathLength="1" d="M28 104 C 24 52, 74 12, 118 18 C 168 25, 192 70, 182 116 C 172 166, 116 194, 70 178 C 30 164, 14 122, 34 82" />
              <path className="intro-sketch-stroke" pathLength="1" d="M44 70 C 64 30, 132 22, 166 58 C 196 92, 178 160, 120 176 C 70 190, 26 154, 30 108" />
              <defs>
                <path id="intro-sketch-path" d="M100,100 m-62,0 a62,62 0 1,1 124,0 a62,62 0 1,1 -124,0" />
              </defs>
              <text className="intro-sketch-ring">
                <textPath href="#intro-sketch-path" textLength="380" lengthAdjust="spacing">
                  THE SKETCHBOOK · DRAWN IN TBILISI ·
                </textPath>
              </text>
            </svg>
            <span className="intro-orb-label">Start</span>
          </button>
          <button type="button" className="text-link intro-quiet" onClick={() => start('sketch', false)}>
            Continue without sound
          </button>
        </div>

        <span className="intro-divider" aria-hidden="true" />
        <span className="intro-or" aria-hidden="true">
          or
        </span>
      </div>

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

      <div className="intro-chrome" aria-hidden="true">
        <span>Custom furniture · Tbilisi</span>
        <span>room.kenchogroup.ge</span>
      </div>
    </section>
  )
}
