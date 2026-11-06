import { useRef, useState, type CSSProperties } from 'react'
import { gsap, ScrollTrigger, SplitText, useGSAP, fine, reduced } from '@/page/fx'
import { FINISHES, FINISH_EVENT, FINISH_KEY } from '@/page/content'
import { narrator } from '@/lib/narrator'

/*
 * (03) Palettes. Each of the room's five kitchen finishes is drawn as a
 * kitchen reduced to stripes: wall units, splashback, a thin worktop, base
 * fronts. Side by side they make a seventies stripe wall. The scroll opens
 * them one after another; hover opens one; a click picks it, and the pick
 * is carried down into the room under the page.
 */
const BANDS = [
  ['cabinets', 4],
  ['tile', 2.2],
  ['worktop', 0.7],
  ['fronts', 3.6],
] as const

const stored = () => {
  try {
    const id = localStorage.getItem(FINISH_KEY)
    return Math.max(0, FINISHES.findIndex((t) => t.id === id))
  } catch {
    return 0
  }
}

/* Light or dark ink on a colour (relative luminance). */
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32
}

export default function Finishes() {
  const root = useRef<HTMLElement>(null)
  const touched = useRef(false)
  const [picked, setPicked] = useState(stored)
  const [open, setOpen] = useState(stored)
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? open

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const split = SplitText.create(q('.pal-title'), { type: 'words,chars', charsClass: 'pc', mask: 'words' })
      if (reduced()) return () => split.revert()
      gsap.from(q('.pal-title .pc'), { yPercent: 110, duration: 1.2, stagger: 0.02, ease: 'expo.out', scrollTrigger: { trigger: root.current, start: 'top 70%' } })
      gsap.from(q('.pal-kicker'), { y: 16, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 70%' } })
      // the paint pours in, column by column, stripe by stripe
      gsap.from(q('.pal-band'), {
        scaleY: 0,
        transformOrigin: '50% 0%',
        duration: 1.1,
        ease: 'expo.out',
        stagger: { each: 0.05, grid: [FINISHES.length, BANDS.length], from: 'start', axis: 'x' },
        scrollTrigger: { trigger: q('.pal-row')[0], start: 'top 80%' },
      })
      gsap.from(q('.pal-col'), { yPercent: 8, duration: 1.4, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: q('.pal-row')[0], start: 'top 80%' } })
      // the scroll opens them in turn, until the visitor takes over
      ScrollTrigger.create({
        trigger: q('.pal-row')[0],
        start: 'top 55%',
        end: 'bottom 30%',
        onUpdate: (self) => {
          if (!touched.current) setOpen(Math.min(FINISHES.length - 1, Math.floor(self.progress * FINISHES.length)))
        },
      })
      return () => split.revert()
    },
    { scope: root },
  )

  const pick = (i: number) => {
    touched.current = true
    setOpen(i)
    if (i === picked) return
    const t = FINISHES[i]
    setPicked(i)
    try {
      localStorage.setItem(FINISH_KEY, t.id)
    } catch {
      // private mode: the room just starts on its own default
    }
    window.dispatchEvent(new CustomEvent(FINISH_EVENT, { detail: t.id }))
    void narrator.say(`finish-${t.id}`, { priority: 2 })
    const col = root.current?.querySelectorAll<HTMLElement>('.pal-col')[i]
    if (col && !reduced()) gsap.fromTo(col.querySelectorAll('.pal-band'), { scaleX: 0.86 }, { scaleX: 1, duration: 0.9, stagger: 0.05, ease: 'elastic.out(1, 0.45)', clearProps: 'transform' })
  }

  return (
    <section ref={root} className="pal" id="finishes" aria-labelledby="pal-title">
      <header className="pal-head">
        <p className="kicker pal-kicker">
          <span>(03)</span> Palettes
        </p>
        <h2 id="pal-title" className="pal-title">
          Pick a <em>palette.</em>
        </h2>
      </header>
      <div className="pal-row" role="radiogroup" aria-label="Kitchen palette" onPointerLeave={() => setHover(null)}>
        {FINISHES.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={i === picked}
            aria-label={`${t.name}: ${t.note}`}
            className="pal-col"
            data-open={shown === i || undefined}
            data-light={light(t.colors.fronts) || undefined}
            onPointerEnter={() => fine() && setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => pick(i)}
          >
            {BANDS.map(([k, w]) => (
              <span key={k} className="pal-band" style={{ background: t.colors[k], '--w': w } as CSSProperties} />
            ))}
            <span className="pal-name">{t.name}</span>
            {i === picked && <span className="pal-picked">In the room</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
