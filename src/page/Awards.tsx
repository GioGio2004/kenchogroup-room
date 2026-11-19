import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AWARDS, certificate } from '@/page/content'
import { SEAL } from '@/page/seal'
import { AWARDS_EVENT } from '@/page/awards-event'
import '@/styles/awards.css'

/*
 * The awards: Orpetron's Site of the Day seal, stamped on the hero's arch
 * (it goes to the page's Orpetron listing), and the awards popup, terracotta
 * and cream like the menu: the jury's three scores drawn as rings, and both
 * certificates hung like prints. The menu opens it, with `openAwards()`.
 */

type Lenis = { stop: () => void; start: () => void }
const lenis = () => (window as Window & { __lenis?: Lenis }).__lenis

const Arrow = () => (
  <svg className="nav-arrow" width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/* The seal itself: gold paper, ink lines. It goes to the page's listing on Orpetron. */
export function Seal({ className = '' }: { className?: string }) {
  return (
    <a className={`seal ${className}`} href={AWARDS.url} target="_blank" rel="noopener" aria-label={`Site of the Day, ${AWARDS.by}, ${AWARDS.date}. See it on Orpetron`}>
      <span className="seal-stamp">
        <span className="seal-spin">
          <svg viewBox={SEAL.viewBox} aria-hidden="true">
            <path className="seal-paper" d={SEAL.outline} />
            <path d={SEAL.art} />
          </svg>
        </span>
      </span>
    </a>
  )
}

export default function Awards() {
  const panel = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const [on, setOn] = useState(false)
  // the certificates load the first time the popup opens, not with the page
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const open = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setSeen(true)
      setOn(true)
    }
    window.addEventListener(AWARDS_EVENT, open)
    return () => window.removeEventListener(AWARDS_EVENT, open)
  }, [])

  // Like the menu: the page holds still, Escape closes, focus comes back.
  useEffect(() => {
    if (!on) return
    const box = panel.current
    lenis()?.stop()
    requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }))
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOn(false)
    window.addEventListener('keydown', key)
    return () => {
      lenis()?.start()
      window.removeEventListener('keydown', key)
      if (!document.activeElement || box?.contains(document.activeElement)) opener.current?.focus({ preventScroll: true })
    }
  }, [on])

  return (
    <>
      <div className="aw-scrim" data-on={on || undefined} onClick={() => setOn(false)} aria-hidden="true" />
      <aside
        ref={panel}
        className="aw-panel"
        data-on={on || undefined}
        inert={!on}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aw-title"
        data-lenis-prevent
      >
        <div className="panel-top">
          <p className="panel-kicker">Awards</p>
          <button ref={closeButton} type="button" className="panel-close" onClick={() => setOn(false)}>
            Close <span className="panel-x" aria-hidden="true" />
          </button>
        </div>

        <div className="aw-body">
          <div className="aw-head">
            <h2 id="aw-title" className="aw-title">
              Site of the Day.
            </h2>
            <p className="aw-lede">
              {AWARDS.by}, {AWARDS.date}. The jury&apos;s scores, out of ten:
            </p>
            <a className="aw-link" href={AWARDS.url} target="_blank" rel="noopener">
              See it on Orpetron{' '}
              <Arrow />
            </a>
          </div>

          <ul className="aw-scores">
            {AWARDS.scores.map(([label, v], i) => (
              <li key={label} className="aw-score" style={{ '--v': v / 10, '--i': i } as CSSProperties}>
                <span className="aw-dial">
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle className="aw-track" cx="50" cy="50" r="46" />
                    <circle className="aw-ring" cx="50" cy="50" r="46" />
                  </svg>
                  <b>{v.toFixed(1)}</b>
                </span>
                <span className="aw-label">{label}</span>
              </li>
            ))}
          </ul>

          <div className="aw-certs">
            {AWARDS.certificates.map((c, i) => (
              <a key={c.key} className="aw-cert" style={{ '--i': i } as CSSProperties} href={certificate(c.key, 1440)} target="_blank" rel="noopener">
                <span className="aw-print">
                  {seen && (
                    <img
                      src={certificate(c.key, 720)}
                      srcSet={`${certificate(c.key, 720)} 720w, ${certificate(c.key, 1440)} 1440w`}
                      sizes="(max-width: 760px) 44vw, 22vw"
                      width={720}
                      height={1018}
                      alt={`Orpetron's ${c.title} certificate for Kencho Group, ${AWARDS.date}`}
                      decoding="async"
                    />
                  )}
                </span>
                {/* (a no-break space keeps the arrow with the last word) */}
                <span className="aw-caption">
                  {c.title}
                  {' '}
                  <Arrow />
                </span>
              </a>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}
