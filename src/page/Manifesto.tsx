import { useRef } from 'react'
import { gsap, SplitText, useGSAP, reduced } from '@/page/fx'

/*
 * (01) What we do: one sentence, centred on a full screen that holds still
 * while it lights up word by word, the four verbs in the accent colour.
 */
export default function Manifesto() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const split = SplitText.create(q('.mf-text'), { type: 'words', wordsClass: 'mw' })
      if (reduced()) return () => split.revert()
      // the section holds still while the sentence lights up, word by word,
      // then keeps it lit a moment longer before letting go
      const words = split.words
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: root.current, start: 'top top', end: () => `+=${innerHeight * 1.6}`, pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
        })
        .fromTo(words, { opacity: 0.12 }, { opacity: 1, duration: 0.5, stagger: 0.12 })
        .to({}, { duration: words.length * 0.03 })
      gsap.from(q('.mf-kicker'), { y: 16, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: root.current, start: 'top 75%' } })
      return () => split.revert()
    },
    { scope: root },
  )

  return (
    <section ref={root} className="manifesto" id="what" aria-labelledby="mf-title">
      <p className="kicker mf-kicker" id="mf-title">
        <span>(01)</span> What we do
      </p>
      <p className="mf-text">
        Nothing here comes off a shelf. We <em>measure</em> your room, <em>draw</em> every millimetre, <em>build</em> it in our own workshop in Tbilisi, and <em>fit</em> it ourselves.
      </p>
    </section>
  )
}
