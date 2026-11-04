import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'
import { CARDS, type Card, type Chunk } from '@/lib/kinetic-script'
import { line, LINES, NARRATION } from '@/lib/narration'
import { PHOTOS } from '@/lib/scene-assets'
import type { Origin } from '@/scenes/opening/Intro'

/* Words land on the voice: chunks start this much before their word. */
const LEAD = 0.08
const CUT_LEAD = 0.12

const words = (ch: Chunk) => line(ch.line).words.slice(ch.from, ch.to + 1)
const startOf = (ch: Chunk) => words(ch)[0].start
const endOf = (ch: Chunk) => words(ch).at(-1)!.end
const textOf = (ch: Chunk) => words(ch).map((w) => w.text).join(' ')
const cardStart = (card: Card) => Math.max(0, startOf(card.chunks[0]) - CUT_LEAD)

const SPLIT_FX = new Set(['type', 'scatter'])

/* Fixed layouts so the server-free first paint and every replay match. */
const SCATTER_SLOTS = [
  { l: 5, t: 9, w: 17, r: -5 },
  { l: 75, t: 7, w: 12, r: 4 },
  { l: 84, t: 40, w: 11, r: -3 },
  { l: 69, t: 69, w: 18, r: 3 },
  { l: 7, t: 64, w: 14, r: 5 },
  { l: 37, t: 4, w: 9, r: -2 },
  { l: 43, t: 79, w: 10, r: 6 },
]
const HA_SLOTS = [
  { l: 12, t: 18, r: -14 },
  { l: 77, t: 24, r: 11 },
  { l: 66, t: 72, r: -6 },
]

interface KineticProps {
  audio: RefObject<HTMLAudioElement | null>
  sound: boolean
  /** the Start button the scene grows out of */
  origin: Origin
  /** preloaded blob URLs by asset path */
  urls: Record<string, string>
  /** the opening is over (played out or skipped): on to the room */
  onFinish: () => void
}

/*
 * Kinetic typography on the narration. Every phrase is a full-screen card
 * that hard-cuts in on its first word; chunks enter with their own effect.
 * One master timeline in narration seconds: the audio clock drives it while
 * the voice plays, its own clock otherwise.
 */
export default function Kinetic({ audio, sound: startWithSound, origin, urls, onFinish }: KineticProps) {
  const u = (src: string) => urls[src] ?? src
  const root = useRef<HTMLElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const driver = useRef<'audio' | 'clock'>(startWithSound ? 'audio' : 'clock')
  const [sound, setSound] = useState(startWithSound)
  const [ended, setEnded] = useState(false)
  const finish = useRef(onFinish)
  useEffect(() => {
    finish.current = onFinish
  })

  // The scene grows out of the Start button.
  useGSAP(
    () => {
      gsap.fromTo(
        root.current,
        { clipPath: `circle(${origin.r}px at ${origin.x}px ${origin.y}px)` },
        { clipPath: `circle(150% at ${origin.x}px ${origin.y}px)`, duration: 0.75, ease: 'expo.inOut', clearProps: 'clipPath' },
      )
    },
    { scope: root },
  )

  useGSAP(
    () => {
      const reduced = prefersReducedMotion()
      const q = gsap.utils.selector(root)
      const t = gsap.timeline({
        paused: true,
        onComplete: () => {
          setEnded(true)
          finish.current()
        },
      })
      const vw = window.innerWidth

      CARDS.forEach((card, i) => {
        const sel = (s = '') => q(`[data-card="${i}"] ${s}`.trim())
        const el = q(`[data-card="${i}"]`)
        const inner = sel('.k-inner')
        const start = cardStart(card)
        const next = CARDS[i + 1]
        const end = next ? cardStart(next) : NARRATION.duration + 1.2
        const span = end - start

        // ---- the cut ------------------------------------------------------
        t.set(el, { autoAlpha: 1 }, start)
        if (next) {
          if (!reduced && card.exit === 'zoom') {
            t.to(inner, { scale: 4, filter: 'blur(24px)', opacity: 0, duration: 0.22, ease: 'power3.in' }, end - 0.22)
          } else if (!reduced && card.exit !== 'cut') {
            t.to(inner, { scale: 1.06, filter: 'blur(10px)', opacity: 0, duration: 0.14, ease: 'power2.in' }, end - 0.14)
          }
          t.set(el, { autoAlpha: 0 }, end)
        }

        // ---- photographs ----------------------------------------------------
        if (card.photo && !reduced) {
          const { mode } = card.photo
          if (mode === 'behind') {
            t.fromTo(sel('.k-photo'), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, start)
              .fromTo(sel('.k-photo img'), { scale: 1.18 }, { scale: 1.02, duration: span, ease: 'none' }, start)
          } else if (mode === 'card') {
            t.fromTo(
              sel('.k-photo-card'),
              { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.12 },
              { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 0.6, ease: 'expo.out' },
              start + 0.04,
            ).fromTo(sel('.k-photo-card img'), { scale: 1.2 }, { scale: 1.04, duration: span, ease: 'none' }, start)
          } else if (mode === 'scatter') {
            const from = Math.max(start, line(card.chunks[0].line).words[3]?.start - LEAD || start)
            t.fromTo(
              sel('.k-scatter-img'),
              { opacity: 0, scale: 0.2, rotate: (j: number) => (j % 2 ? 25 : -25) },
              {
                opacity: 1,
                scale: 1,
                rotate: (j: number) => SCATTER_SLOTS[j % SCATTER_SLOTS.length].r,
                duration: 0.55,
                ease: 'back.out(1.6)',
                stagger: 0.06,
              },
              from,
            )
          } else if (mode === 'strip') {
            t.fromTo(sel('.k-strip'), { opacity: 0, xPercent: 0 }, { opacity: 1, duration: 0.4 }, start).fromTo(
              sel('.k-strip'),
              { xPercent: 0 },
              { xPercent: -50, duration: span + 0.5, ease: 'none' },
              start,
            )
          }
        }

        // ---- decorations ------------------------------------------------------
        if (card.ha && !reduced) {
          const [hs, he] = card.ha
          t.fromTo(
            sel('.k-ha'),
            { opacity: 0, scale: 0, rotate: (j: number) => HA_SLOTS[j].r * 3 },
            { opacity: 1, scale: 1, rotate: (j: number) => HA_SLOTS[j].r, duration: 0.3, ease: 'back.out(2)', stagger: (he - hs) / 4 },
            hs,
          ).to(sel('.k-ha'), { opacity: 0, scale: 0.6, duration: 0.2, ease: 'power2.in' }, he)
        }
        if (card.slash !== undefined && !reduced) {
          t.fromTo(sel('.k-slash'), { scaleX: 0 }, { scaleX: 1, duration: 0.22, ease: 'power3.out', stagger: 0.08 }, card.slash)
        }
        if (card.glyphs && !reduced) {
          const ask = line('ask').words
          t.fromTo(
            sel('.k-q'),
            { opacity: 0, scale: 0.3, rotate: -40, yPercent: 30 },
            {
              opacity: 1,
              scale: 1,
              rotate: (j: number) => [12, -8, 20][j],
              yPercent: 0,
              duration: 0.55,
              ease: 'back.out(1.5)',
              stagger: 0.18,
            },
            ask[4].start - LEAD,
          )
        }
        if (card.cursor && !reduced) {
          const at = startOf(card.chunks[0])
          t.fromTo(
            sel('.k-cursor'),
            { x: vw * 0.32, y: window.innerHeight * 0.4, opacity: 0 },
            { x: 0, y: 0, opacity: 1, duration: 0.55, ease: 'power3.inOut' },
            at - 0.2,
          )
            .to(sel('.k-cursor'), { scale: 0.78, duration: 0.08, yoyo: true, repeat: 1 }, endOf(card.chunks[0]) - 0.05)
            .to(sel('.k-photo-card'), { scale: 0.96, duration: 0.08, yoyo: true, repeat: 1 }, endOf(card.chunks[0]) - 0.05)
        }

        // ---- the words --------------------------------------------------------
        card.chunks.forEach((ch, j) => {
          const target = sel(`[data-chunk="${j}"]`)
          const at = startOf(ch) - LEAD
          const held = Math.max(0.3, endOf(ch) - at)
          if (reduced) {
            t.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at)
            return
          }
          switch (ch.fx) {
            case 'slam':
              t.fromTo(
                target,
                { opacity: 0, scale: 1.7, filter: 'blur(18px)' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.34, ease: 'expo.out' },
                at,
              )
              break
            case 'stretch':
              t.fromTo(
                target,
                { opacity: 0, scaleX: 0.15, skewX: -24, filter: 'blur(14px)' },
                { opacity: 1, scaleX: 1, skewX: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' },
                at,
              )
              break
            case 'vowel':
              t.fromTo(
                target,
                { opacity: 0, scaleX: 0.2, filter: 'blur(14px)', letterSpacing: '-0.08em' },
                { opacity: 1, scaleX: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' },
                at,
              ).to(target, { letterSpacing: '0.16em', duration: held, ease: 'sine.inOut' }, at + 0.2)
              break
            case 'smear':
              t.fromTo(
                target,
                { opacity: 0, xPercent: j % 2 ? 60 : -60, skewX: j % 2 ? 34 : -34, filter: 'blur(22px)' },
                { opacity: 1, xPercent: 0, skewX: 0, filter: 'blur(0px)', duration: 0.45, ease: 'expo.out' },
                at,
              )
              break
            case 'zoom':
              t.fromTo(
                target,
                { opacity: 0, scale: 0.25, filter: 'blur(16px)' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' },
                at,
              )
              break
            case 'slit':
              t.fromTo(
                target,
                { opacity: 0, scaleY: 5, filter: 'blur(12px)' },
                { opacity: 1, scaleY: 1, filter: 'blur(0px)', duration: 0.45, ease: 'expo.out' },
                at,
              )
              break
            case 'focus':
              t.fromTo(
                target,
                { opacity: 0, scale: 1.14, filter: 'blur(18px)' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out' },
                at,
              )
              break
            case 'fill':
              t.fromTo(
                target,
                { opacity: 0, scale: 1.6, filter: 'blur(16px)', backgroundPosition: '20% 50%' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.38, ease: 'expo.out' },
                at,
              ).to(target, { backgroundPosition: '80% 50%', duration: Math.max(0.6, end - at), ease: 'none' }, at)
              break
            case 'crop':
              t.fromTo(target, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.16, ease: 'power4.out' }, at)
                // set + to (not fromTo): the flash is shared, so it must not
                // render its start state before its moment.
                .set(q('.k-flash'), { opacity: 0.55 }, at)
                .to(q('.k-flash'), { opacity: 0, duration: 0.2, ease: 'power2.out' }, at + 0.01)
                .to(inner, { x: 16, duration: 0.035, repeat: 3, yoyo: true, ease: 'none' }, at + 0.14)
              break
            case 'glitch':
              t.fromTo(
                target,
                { opacity: 0, scale: 1.3, '--g1': '22px', '--g2': '-18px' },
                { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out' },
                at,
              ).to(target, { '--g1': '0px', '--g2': '0px', duration: 0.5, ease: 'steps(7)' }, at + 0.05)
              break
            case 'outline':
              t.fromTo(target, { opacity: 0, scale: 1.12, '--fill': '100%' }, { opacity: 1, scale: 1, duration: 0.4, ease: 'expo.out' }, at).to(
                target,
                { '--fill': '0%', duration: 0.6, ease: 'power2.inOut' },
                at + 0.25,
              )
              break
            case 'type': {
              const chars = sel(`[data-chunk="${j}"] .k-ch`)
              t.set(target, { opacity: 1 }, at)
                .fromTo(chars, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: (held * 0.85) / chars.length }, at)
                .fromTo(sel(`[data-chunk="${j}"] .k-caret`), { opacity: 0 }, { opacity: 1, duration: 0.01 }, at)
              break
            }
            case 'scatter': {
              const chars = sel(`[data-chunk="${j}"] .k-ch`)
              const mid = (chars.length - 1) / 2
              t.fromTo(
                target,
                { opacity: 0, scale: 1.4, filter: 'blur(14px)' },
                { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.35, ease: 'expo.out' },
                at,
              )
                .fromTo(
                  chars,
                  { x: 0 },
                  { x: (k: number) => (k - mid) * vw * 0.045, duration: Math.max(0.8, end - at - 0.3), ease: 'power3.out' },
                  at + 0.25,
                )
                .to(inner, { scale: 0.82, duration: Math.max(0.8, end - at - 0.3), ease: 'power2.inOut' }, at + 0.25)
              break
            }
            case 'rise':
            default:
              t.fromTo(target, { opacity: 0, yPercent: 70 }, { opacity: 1, yPercent: 0, duration: 0.42, ease: 'expo.out' }, at)
          }
        })
      })

      // HOME holds for a breath before the room takes over.
      t.to({}, { duration: 0.01 }, LINES.at(-1)!.end + 1.1)
      tl.current = t
    },
    { scope: root },
  )

  useEffect(() => {
    const t = tl.current
    const a = audio.current
    if (!t) return
    if (driver.current === 'clock') t.play(0)
    const sync = () => {
      if (driver.current === 'audio' && a) t.time(Math.min(a.currentTime, t.duration()))
    }
    // The voice ends a beat before the timeline (the links still have to
    // arrive), so hand over to the timeline's own clock for the tail.
    const onEnded = () => {
      driver.current = 'clock'
      t.play()
    }
    gsap.ticker.add(sync)
    a?.addEventListener('ended', onEnded)

    // ?calibrate: press Space at the start of each line to log exact times.
    const marks: number[] = []
    const calibrate = new URLSearchParams(location.search).has('calibrate')
    const onKey = (e: KeyboardEvent) => {
      if (!calibrate || e.code !== 'Space' || !a) return
      e.preventDefault()
      marks.push(Number(a.currentTime.toFixed(2)))
      console.info(`[calibrate] line ${marks.length}/${LINES.length}: ${marks.at(-1)}s`)
      if (marks.length === LINES.length) console.info('[calibrate] starts:', JSON.stringify(marks))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      gsap.ticker.remove(sync)
      a?.removeEventListener('ended', onEnded)
      window.removeEventListener('keydown', onKey)
    }
  }, [audio])

  const toggleSound = () => {
    const t = tl.current
    const a = audio.current
    if (!t || !a) return
    if (driver.current === 'clock') {
      a.currentTime = Math.min(t.time(), NARRATION.duration)
      void a.play().then(() => {
        t.pause()
        driver.current = 'audio'
        setSound(true)
      })
    } else {
      a.pause()
      driver.current = 'clock'
      if (!ended) t.play()
      setSound(false)
    }
  }

  const skip = () => {
    audio.current?.pause()
    driver.current = 'clock'
    tl.current?.pause()
    setEnded(true)
    finish.current()
  }

  return (
    <section ref={root} className="kinetic" aria-label="Opening">
      <p className="sr-only">{LINES.map((l) => l.text).join(' ')}</p>

      {CARDS.map((card, i) => (
        <div
          key={i}
          data-card={i}
          className="k-card"
          data-bg={card.bg}
          aria-hidden="true"
        >
          {card.photo?.mode === 'behind' && (
            <div className="k-photo" data-full={card.photo.full || undefined}>
              <img src={u(PHOTOS[card.photo.keys[0]].src)} alt="" />
            </div>
          )}
          {card.photo?.mode === 'strip' && (
            <div className="k-strip">
              {[...card.photo.keys, ...card.photo.keys].map((k, j) => (
                <img key={j} src={u(PHOTOS[k].src)} alt="" />
              ))}
            </div>
          )}
          {card.photo?.mode === 'scatter' &&
            card.photo.keys.map((k, j) => {
              const s = SCATTER_SLOTS[j % SCATTER_SLOTS.length]
              return (
                <img
                  key={k}
                  className="k-scatter-img"
                  src={u(PHOTOS[k].src)}
                  alt=""
                  style={{ left: `${s.l}vw`, top: `${s.t}vh`, width: `${s.w}vw`, aspectRatio: PHOTOS[k].ratio }}
                />
              )
            })}

          <div className="k-inner">
            {card.photo?.mode === 'card' && (
              <figure className="k-photo-card" style={{ aspectRatio: PHOTOS[card.photo.keys[0]].ratio }}>
                <img src={u(PHOTOS[card.photo.keys[0]].src)} alt="" />
              </figure>
            )}
            {card.glyphs && (
              <>
                <span className="k-q k-q-1">?</span>
                <span className="k-q k-q-2">?</span>
                <span className="k-q k-q-3">?</span>
              </>
            )}
            {card.chunks.map((ch, j) => {
              const text = textOf(ch)
              const style: CSSProperties | undefined =
                ch.fx === 'fill' && ch.photo ? { backgroundImage: `url(${u(PHOTOS[ch.photo].src)})` } : undefined
              return (
                <span
                  key={j}
                  data-chunk={j}
                  data-fx={ch.fx}
                  data-size={ch.size}
                  data-text={text}
                  className="k-chunk"
                  style={style}
                >
                  {SPLIT_FX.has(ch.fx)
                    ? [...text].map((char, k) => (
                        <span key={k} className="k-ch">
                          {char === ' ' ? ' ' : char}
                        </span>
                      ))
                    : text}
                  {ch.fx === 'type' && <span className="k-caret" />}
                </span>
              )
            })}
            {card.cursor && (
              <svg className="k-cursor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 2l17 9.5-7.4 1.7L9.2 21z" />
              </svg>
            )}
          </div>

          {card.slash !== undefined && (
            <>
              <span className="k-slash k-slash-1" />
              <span className="k-slash k-slash-2" />
            </>
          )}
          {card.ha &&
            HA_SLOTS.map((s, j) => (
              <span key={j} className="k-ha" style={{ left: `${s.l}%`, top: `${s.t}%` }}>
                HA
              </span>
            ))}
        </div>
      ))}

      <div className="k-flash" aria-hidden="true" />

      <div className="k-controls">
        <button type="button" className="text-link" onClick={toggleSound} aria-pressed={sound}>
          {sound ? 'Sound on' : 'Sound off'}
        </button>
        {!ended && (
          <button type="button" className="text-link" onClick={skip}>
            Skip
          </button>
        )}
      </div>
    </section>
  )
}
