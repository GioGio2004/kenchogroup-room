import { useRef, type CSSProperties } from 'react'
import { gsap, SplitText, useGSAP, reduced } from '@/page/fx'
import { PIECES, photo, PHOTO } from '@/page/content'
import { SHAPES } from '@/page/shapes'

/*
 * (02) What we make. The section pins and six cards slide past sideways,
 * each its own colour and photo shape. As a card arrives its photo settles
 * and its title rises. That's all.
 */
export default function Pieces() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const track = q('.pieces-track')[0]
      const split = SplitText.create(q('.piece-title, .pieces-title'), { type: 'words,chars', charsClass: 'pc', mask: 'words' })
      if (reduced()) return () => split.revert()

      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)
      const slide = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.9,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(q('.pieces-bar i'), { scaleX: self.progress }),
        },
      })

      gsap.from(q('.pieces-title .pc'), { yPercent: 110, duration: 1.2, stagger: 0.02, ease: 'expo.out', scrollTrigger: { trigger: root.current, start: 'top 70%' } })
      gsap.from(q('.pieces-intro .reveal'), { y: 20, autoAlpha: 0, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 60%' } })

      q('.piece').forEach((card) => {
        const at = { trigger: card, containerAnimation: slide }
        gsap.fromTo(card.querySelector('.piece-photo img'), { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { ...at, start: 'left right', end: 'right 60%', scrub: true } })
        gsap.from(card.querySelectorAll('.piece-title .pc'), { yPercent: 110, duration: 1.1, stagger: 0.025, ease: 'expo.out', scrollTrigger: { ...at, start: 'left 72%', toggleActions: 'play none none reverse' } })
        gsap.from(card.querySelector('.piece-text'), { y: 20, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { ...at, start: 'left 62%', toggleActions: 'play none none reverse' } })
      })
      return () => split.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} className="pieces" id="pieces" aria-labelledby="pieces-title">
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <clipPath id="clip-flower" clipPathUnits="objectBoundingBox">
          <path transform="scale(0.005)" d={SHAPES.flower} />
        </clipPath>
      </svg>
      <div className="pieces-track">
        <header className="pieces-intro">
          <p className="kicker reveal">
            <span>(02)</span> What we make
          </p>
          <h2 id="pieces-title" className="pieces-title">
            Six things we&apos;re <em>rather</em> good at.
          </h2>
          <p className="pieces-lede reveal">Every piece is drawn for one wall, in one home.</p>
        </header>

        {PIECES.map((p) => (
          <article key={p.n} className="piece" data-shape={p.shape} style={{ '--bg': p.bg, '--fg': p.fg } as CSSProperties}>
            <div className="piece-copy">
              <span className="piece-n">{p.n}</span>
              <h3 className="piece-title">{p.title}</h3>
              <p className="piece-text">{p.text}</p>
            </div>
            <div className="piece-art">
              <figure className="piece-photo">
                <img src={photo(p.photo)} width={PHOTO[p.photo].w} height={PHOTO[p.photo].h} alt={PHOTO[p.photo].alt} loading="lazy" />
              </figure>
            </div>
          </article>
        ))}
        <div className="pieces-end" aria-hidden="true">
          <p>…and anything else in wood.</p>
        </div>
      </div>
      <div className="pieces-hud" aria-hidden="true">
        <span className="pieces-bar">
          <i />
        </span>
      </div>
    </section>
  )
}
