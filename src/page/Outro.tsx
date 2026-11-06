import { useRef } from 'react'
import { gsap, SplitText, useGSAP, reduced, fine } from '@/page/fx'

/*
 * (04) The last stretch of the page, and the lip of the lid: white on
 * orange to its very edge, the invitation to the room, and KENCHO standing
 * up letter by letter. Keep scrolling and the whole page lifts off the
 * room underneath.
 */
const LETTERS = ['K', 'E', 'N', 'C', 'H', 'O']

export default function Outro() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const split = SplitText.create(q('.outro-title'), { type: 'words,chars', charsClass: 'pc', mask: 'words' })
      if (reduced()) return () => split.revert()
      gsap.from(q('.outro-title .pc'), { yPercent: 110, rotate: 8, duration: 1.2, stagger: 0.025, ease: 'expo.out', scrollTrigger: { trigger: root.current, start: 'top 70%' } })
      gsap.from(q('.outro-reveal'), { y: 24, autoAlpha: 0, duration: 1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 60%' } })
      // KENCHO stands up as the bottom of the page arrives
      gsap.from(q('.outro-letter'), {
        yPercent: 105,
        rotate: (i: number) => (i % 2 ? 14 : -14),
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: { trigger: q('.outro-mark')[0], start: 'top bottom', end: 'bottom 85%', scrub: 0.6 },
      })

      if (!fine()) return () => split.revert()
      // poke a letter and it jumps
      const hop = (e: Event) => {
        const el = e.currentTarget as HTMLElement
        gsap
          .timeline()
          .to(el, { yPercent: -18, rotate: gsap.utils.random(-14, 14), duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
          .to(el, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)' })
      }
      const letters = q('.outro-letter')
      letters.forEach((l) => l.addEventListener('pointerenter', hop))
      return () => {
        letters.forEach((l) => l.removeEventListener('pointerenter', hop))
        split.revert()
      }
    },
    { scope: root },
  )

  return (
    <section ref={root} className="outro" id="outro" data-nav="light" aria-labelledby="outro-title">
      <div className="outro-head">
        <p className="kicker outro-reveal">
          <span>(04)</span> The room
        </p>
        <h2 id="outro-title" className="outro-title">
          Now, design <em>yours.</em>
        </h2>
        <p className="outro-lede outro-reveal">A hand-drawn room, right underneath this page. Keep scrolling.</p>
      </div>
      <p className="outro-mark" aria-label="Kencho">
        {LETTERS.map((l, i) => (
          <span key={i} className="outro-letter" aria-hidden="true">
            {l}
          </span>
        ))}
      </p>
    </section>
  )
}
