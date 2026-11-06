import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { gsap, ScrollTrigger, useGSAP, prefersReducedMotion } from '@/lib/motion'
import { tracker } from '@/lib/tracker'
import '@/styles/nav.css'

/*
 * The navbar from production (the room's header): the wordmark on the left,
 * Gallery and Menu on the right, and the half-screen menu panel. Added here:
 * the narrator's switch and a way back to the intro. It steps aside while
 * you scroll down, comes back when you scroll up, and stays over the footer
 * room, where its menu is the way on.
 */
export interface NavItem {
  id: string
  label: string
  note: string
}

const MAIN = import.meta.env.VITE_MAIN_SITE_URL ?? 'https://www.kenchogroup.ge'

const Arrow = ({ out = true }: { out?: boolean }) => (
  <svg className="nav-arrow" width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d={out ? 'M5 15 15 5M5 5h10v10' : 'M3 10h14M12 5l5 5-5 5'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

type Lenis = { stop: () => void; start: () => void; scrollTo: (t: number | Element, o?: object) => void; resize?: () => void }
const lenis = () => (window as Window & { __lenis?: Lenis }).__lenis

/* Scroll to a section, or to the very bottom for the footer room. */
export function goTo(id: string) {
  const l = lenis()
  const bottom = id === 'room'
  const el = bottom ? null : document.getElementById(id)
  if (!bottom && !el) return
  l?.resize?.()
  const easing = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  const target = bottom ? document.documentElement.scrollHeight : el!
  if (!l) {
    if (typeof target === 'number') window.scrollTo(0, target)
    else target.scrollIntoView()
    return
  }
  l.scrollTo(target, {
    duration: bottom ? 2.6 : 1.8,
    easing,
    // (going to the bottom: if the page grew on the way, finish the last stretch)
    onComplete: bottom
      ? () => {
          l.resize?.()
          const end = document.documentElement.scrollHeight - innerHeight
          if (end - window.scrollY > 2) l.scrollTo(end, { duration: 0.6, easing })
        }
      : undefined,
  })
}

export default function Navbar({
  items,
  voice,
  onVoice,
  onReplay,
  show = true,
}: {
  items: NavItem[]
  voice: boolean
  onVoice: () => void
  onReplay: () => void
  show?: boolean
}) {
  const bar = useRef<HTMLElement>(null)
  const panel = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const panelClose = useRef<HTMLButtonElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const rows = useRef<Array<HTMLElement | null>>([])
  const [menu, setMenu] = useState(false)
  const [here, setHere] = useState<string | null>(null)
  // over a coloured section ([data-nav="light"]) the bar's text turns white
  const [light, setLight] = useState(false)
  const [pointed, setPointed] = useState<number | null>(null)
  const [, setForgotten] = useState(0)
  const reduced = prefersReducedMotion()
  const menuRef = useRef(menu)
  useEffect(() => {
    menuRef.current = menu
  })

  // In on arrival; away on the way down, back on the way up; gone over the footer room.
  useGSAP(
    () => {
      if (!show) {
        gsap.set(bar.current, { yPercent: -120 })
        return
      }
      gsap.to(bar.current, { yPercent: 0, duration: reduced ? 0 : 1.1, ease: 'expo.out', delay: 0.5 })
      ScrollTrigger.create({
        refreshPriority: -1,
        start: 'top -100',
        end: 'max',
        onUpdate: (self) => {
          if (menuRef.current) return
          // over the footer room the bar stays: its menu is the way on from there
          const room = self.scroll() > ScrollTrigger.maxScroll(window) - innerHeight * 0.6
          gsap.to(bar.current, { yPercent: self.direction === 1 && !room ? -120 : 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' })
        },
        onLeaveBack: () => gsap.to(bar.current, { yPercent: 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' }),
      })
      document.querySelectorAll<HTMLElement>('[data-nav="light"]').forEach((el) =>
        ScrollTrigger.create({ refreshPriority: -1, trigger: el, start: 'top 44px', end: 'bottom 44px', onToggle: (st) => setLight(st.isActive) }),
      )
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el) ScrollTrigger.create({ refreshPriority: -1, trigger: el, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => s.isActive && setHere(it.id) })
      }
    },
    { dependencies: [show, items], revertOnUpdate: true },
  )

  // The menu holds the page still; Escape closes it.
  useEffect(() => {
    if (!menu) return
    lenis()?.stop()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu()
    window.addEventListener('keydown', key)
    return () => {
      lenis()?.start()
      window.removeEventListener('keydown', key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu])

  /* The indicator glides to the item being pointed at (or to where you are). */
  const at = items.findIndex((i) => i.id === here)
  const point = (i: number | null) => {
    setPointed(i)
    const el = i === null || i < 0 ? null : rows.current[i]
    if (!indicator.current) return
    if (!el) {
      gsap.to(indicator.current, { opacity: 0, duration: 0.3, overwrite: 'auto' })
      return
    }
    gsap.to(indicator.current, { y: el.offsetTop, scaleY: el.offsetHeight, opacity: 1, duration: reduced ? 0 : 0.55, ease: 'power3.out', overwrite: 'auto' })
  }
  const openMenu = () => {
    setMenu(true)
    requestAnimationFrame(() => {
      panelClose.current?.focus({ preventScroll: true })
      point(at >= 0 ? at : null)
    })
  }
  const closeMenu = () => {
    setMenu(false)
    setPointed(null)
    if (panel.current?.contains(document.activeElement)) menuButton.current?.focus({ preventScroll: true })
  }
  const go = (id: string) => {
    closeMenu()
    // let the panel slide away before the page moves
    window.setTimeout(() => goTo(id), reduced ? 0 : 250)
  }

  const t = tracker.get()
  const minutes = Math.max(1, Math.round(t.timeSpent / 60000))
  const contactsAt = items.length

  return (
    <div className="nav" data-light={light || undefined}>
      <header ref={bar} className="nav-bar">
        <button type="button" className="nav-wordmark" onClick={() => goTo('top')} aria-label="Kencho Group, back to the top">
          <span>KENCHO</span>
          <span className="nav-wordmark-sub">GROUP</span>
        </button>
        <div className="nav-actions">
          <a className="nav-link nav-link-gallery" href={`${MAIN}/en/gallery`}>
            Gallery <Arrow />
          </a>
          <button ref={menuButton} type="button" className="nav-link" aria-expanded={menu} aria-controls="nav-menu" onClick={openMenu}>
            Menu
          </button>
        </div>
      </header>

      <div className="nav-scrim" data-on={menu || undefined} onClick={closeMenu} aria-hidden="true" />
      <aside id="nav-menu" ref={panel} className="nav-panel" data-on={menu || undefined} inert={!menu} aria-label="Menu" data-lenis-prevent>
        <div className="panel-top">
          <p className="panel-kicker">Menu</p>
          <button ref={panelClose} type="button" className="panel-close" onClick={closeMenu}>
            Close <span className="panel-x" aria-hidden="true" />
          </button>
        </div>
        <nav className="panel-nav" aria-label="On this page" onPointerLeave={() => point(at >= 0 ? at : null)}>
          <span ref={indicator} className="panel-indicator" aria-hidden="true" />
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className="panel-item"
              style={{ '--i': i } as CSSProperties}
              data-current={here === it.id || undefined}
              data-pointed={pointed === i || undefined}
              ref={(el) => {
                rows.current[i] = el
              }}
              onPointerEnter={() => point(i)}
              onFocus={() => point(i)}
              onClick={() => go(it.id)}
            >
              <span className="panel-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="panel-label">{it.label}</span>
              <span className="panel-note">{it.note}</span>
            </button>
          ))}
          <a
            className="panel-item"
            style={{ '--i': contactsAt } as CSSProperties}
            data-pointed={pointed === contactsAt || undefined}
            ref={(el) => {
              rows.current[contactsAt] = el
            }}
            onPointerEnter={() => point(contactsAt)}
            onFocus={() => point(contactsAt)}
            href={`${MAIN}/en/contact`}
          >
            <span className="panel-n">{String(contactsAt + 1).padStart(2, '0')}</span>
            <span className="panel-label">
              Book a meeting <Arrow />
            </span>
            <span className="panel-note">On kenchogroup.ge</span>
          </a>
        </nav>
        <div className="panel-foot">
          <div className="panel-extras">
            <button type="button" className="panel-switch" role="switch" aria-checked={voice} onClick={onVoice}>
              <span>Narrator&apos;s voice</span>
              <i aria-hidden="true" />
            </button>
            <button
              type="button"
              className="panel-extra"
              onClick={() => {
                closeMenu()
                onReplay()
              }}
            >
              Return to intro
            </button>
            <a className="panel-extra" href={MAIN}>
              kenchogroup.ge <Arrow />
            </a>
          </div>
          {/* what this browser remembers (kept on this device only), and a way to forget it */}
          <p className="panel-memory">
            Remembered on this device: visit {t.visits}, {minutes} min here.{' '}
            <button
              type="button"
              className="panel-forget"
              onClick={() => {
                tracker.forget()
                setForgotten((n) => n + 1)
              }}
            >
              Forget me
            </button>
          </p>
        </div>
      </aside>
    </div>
  )
}
