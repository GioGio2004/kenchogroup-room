import { useRef } from 'react'
import { gsap, SplitText, useGSAP, phone, reduced, scrollToId } from '@/page/fx'
import { MAIN, photo, PHOTO } from '@/page/content'

/*
 * The hero: three lines of soft serif that land letter by letter, and a
 * real kitchen framed in a plain arch. Nothing else.
 */
export default function Hero({ play }: { play: boolean }) {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const split = SplitText.create(q('.hero-line'), { type: 'chars', charsClass: 'hc' })
      const chars = split.chars as HTMLElement[]
      if (!play) {
        gsap.set([...q('.hero-window, .hero-reveal'), ...chars], { autoAlpha: 0 })
        return () => split.revert()
      }
      if (reduced()) {
        gsap.from([...q('.hero-window, .hero-reveal'), ...chars], { autoAlpha: 0, duration: 0.8 })
        return () => split.revert()
      }

      // ---- the landing -------------------------------------------------
      gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .from(chars, { yPercent: 118, rotate: 8, duration: 1.5, stagger: 0.026 }, 0)
        .from(q('.hero-window'), { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 0 0)', duration: 1.5, ease: 'expo.inOut' }, 0.4)
        .from(q('.hero-window img'), { scale: 1.35, duration: 2.4 }, 0.4)
        .from(q('.hero-reveal'), { y: 20, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: 'power3.out' }, 1)

      // ---- scrolling away: the lines drift apart, the sun sets gently -----
      const st = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 0.6 }
      gsap.to(q('.hero-line[data-i="0"]'), { xPercent: -8, ease: 'none', scrollTrigger: st })
      gsap.to(q('.hero-line[data-i="2"]'), { xPercent: 6, ease: 'none', scrollTrigger: st })
      gsap.to(q('.hero-window img'), { scale: 1.12, ease: 'none', scrollTrigger: st })
      if (!phone()) gsap.to(q('.hero-sun'), { yPercent: 14, ease: 'none', scrollTrigger: st })

      return () => split.revert()
    },
    { scope: root, dependencies: [play], revertOnUpdate: true },
  )

  return (
    <section ref={root} className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title" className="hero-title">
          <span className="hero-line" data-i="0">
            Furniture
          </span>
          <span className="hero-line" data-i="1">
            drawn for
          </span>
          <span className="hero-line hero-line--em" data-i="2">
            your walls.
          </span>
        </h1>
        <p className="hero-lede hero-reveal">Kitchens, wardrobes and whole walls of wood, made to measure in our own workshop in Tbilisi.</p>
        <div className="hero-ctas hero-reveal">
          <button type="button" className="btn btn--ink" onClick={() => scrollToId('room')}>
            Design your kitchen
          </button>
          <a className="btn btn--line" href={`${MAIN}/en/contact`}>
            Book a meeting
          </a>
        </div>
      </div>

      <div className="hero-sun" aria-hidden="true">
        <figure className="hero-window">
          <img src={photo('walnut-island')} width={PHOTO['walnut-island'].w} height={PHOTO['walnut-island'].h} alt="" />
        </figure>
      </div>
    </section>
  )
}
