import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'
import { line, LINES, NARRATION } from '@/lib/narration'
import { PHOTOS, type PhotoKey } from '@/lib/scene-assets'
import type { Origin } from '@/scenes/opening/Intro'
import '@/styles/sketchbook.css'

/* Words land on the voice: elements start this much before their word. */
const LEAD = 0.08
const CUT_LEAD = 0.12

const s = (id: string, i: number) => line(id).words[i].start
const e = (id: string, i: number) => line(id).words[i].end
const at = (id: string, i: number) => s(id, i) - LEAD

/* Twelve sheets of the sketchbook, each cut in just before its first word. */
const SHEETS = [
  { title: 'Hello', from: 0 },
  { title: 'Found', from: s('hello', 1) },
  { title: 'The dream', from: s('kitchen', 0) },
  { title: 'Furniture', from: s('other', 0) },
  { title: 'Upholstery', from: s('sofa', 0) },
  { title: 'The brief', from: s('ask', 0) },
  { title: 'A kitchen', from: s('perhaps', 0) },
  { title: 'Colour', from: s('perhaps', 2) },
  { title: 'Swatches', from: s('colours', 0) },
  { title: 'Plenty', from: s('plenty', 0) },
  { title: 'Space', from: s('space', 0) },
  { title: 'Home', from: s('home', 0) },
].map((sheet, i) => ({ ...sheet, from: i === 0 ? 0 : sheet.from - CUT_LEAD }))
const END = LINES.at(-1)!.end + 1.1
/* these cuts get the striped retro wipe; the others turn the page */
const WIPES = new Set([2, 5, 8, 11])

const RETRO = ['#3e5848', '#c0603e', '#d6a048', '#6f8f86', '#7b5437', '#8e9b85', '#1f1c18']
const BOARD: Array<{ key: PhotoKey; l: number; t: number; w: number; r: number }> = [
  { key: 'kitchen', l: 4, t: 12, w: 20, r: -6 },
  { key: 'mirror', l: 75, t: 9, w: 11, r: 5 },
  { key: 'oakWall', l: 77, t: 52, w: 18, r: -4 },
  { key: 'corridor', l: 55, t: 70, w: 17, r: 3 },
  { key: 'bedroom', l: 6, t: 60, w: 17, r: 6 },
  { key: 'wardrobe', l: 30, t: 6, w: 14, r: -3 },
  { key: 'shelves', l: 27, t: 72, w: 16, r: -5 },
]
const ORBIT: PhotoKey[] = ['station', 'forest', 'white', 'greige', 'oakWall', 'shelves']
const FLAP = 'FURNITURE'
const FLAP_NOISE = 'KQZMAEOXBLHS'

interface SketchbookProps {
  audio: RefObject<HTMLAudioElement | null>
  sound: boolean
  /** the Start button the sketchbook grows out of */
  origin: Origin
  /** preloaded blob URLs by asset path */
  urls: Record<string, string>
  /** the opening is over (played out or skipped): on to the room */
  onFinish: () => void
}

/* Letters as spans, grouped by word so lines only break between words. */
const Chars = ({ text, className = 'sb-ch', style }: { text: string; className?: string; style?: (i: number) => CSSProperties }) => {
  let n = 0
  return (
    <>
      {text.split(' ').map((word, w) => (
        <span key={w} className="sb-word">
          {w > 0 && ' '}
          {[...word].map((c) => {
            const i = n++
            return (
              <span key={i} className={className} style={style?.(i)}>
                {c}
              </span>
            )
          })}
        </span>
      ))}
    </>
  )
}

/* A photo print, taped to the page. */
const Print = ({ src, className, polaroid, style }: { src: string; className: string; polaroid?: boolean; style?: CSSProperties }) => (
  <figure className={`sb-print ${className}`} data-polaroid={polaroid || undefined} style={style}>
    <span className="sb-tape sb-tape-l" />
    <span className="sb-tape sb-tape-r" />
    <img src={src} alt="" />
  </figure>
)

/* A photo that starts as a pencil sketch and brushes into colour. */
const Sketched = ({ src, className }: { src: string; className: string }) => (
  <div className={`sb-sketched ${className}`}>
    <img className="sb-sketched-pencil" src={src} alt="" />
    <img className="sb-sketched-colour" src={src} alt="" />
  </div>
)

const Sheet = ({ i, children }: { i: number; children: ReactNode }) => (
  <div className="sb-scene" data-scene={i}>
    <div className="sb-sheet">{children}</div>
    <p className="sb-sheet-no">
      Sheet {String(i + 1).padStart(2, '0')} / 12 · {SHEETS[i].title}
    </p>
  </div>
)

/*
 * The retro opening: the same narrator, the same word timings, drawn as a
 * designer's sketchbook. Paper and ink, a 70s palette, and a new trick on
 * every sheet: stamps, split-flap letters, a red-pencil scribble, paint
 * chips, a taped mood board, kitchens that sketch themselves into colour.
 * One master timeline in narration seconds, driven by the voice.
 */
export default function Sketchbook({ audio, sound: startWithSound, origin, urls, onFinish }: SketchbookProps) {
  const u = (key: PhotoKey) => urls[PHOTOS[key].src] ?? PHOTOS[key].src
  const root = useRef<HTMLElement>(null)
  const tl = useRef<gsap.core.Timeline | null>(null)
  const driver = useRef<'audio' | 'clock'>(startWithSound ? 'audio' : 'clock')
  const [sound, setSound] = useState(startWithSound)
  const [ended, setEnded] = useState(false)
  const finish = useRef(onFinish)
  useEffect(() => {
    finish.current = onFinish
  })

  // The sketchbook opens out of the Start button.
  useGSAP(
    () => {
      gsap.fromTo(
        root.current,
        { clipPath: `circle(${origin.r}px at ${origin.x}px ${origin.y}px)` },
        { clipPath: `circle(150% at ${origin.x}px ${origin.y}px)`, duration: 0.8, ease: 'expo.inOut', clearProps: 'clipPath' },
      )
    },
    { scope: root },
  )

  useGSAP(
    () => {
      const reduced = prefersReducedMotion()
      const q = gsap.utils.selector(root)
      const S = (i: number, sel = '') => q(`[data-scene="${i}"] ${sel}`.trim())
      const t = gsap.timeline({
        paused: true,
        onComplete: () => {
          setEnded(true)
          finish.current()
        },
      })
      const vw = window.innerWidth
      const portrait = window.innerWidth < window.innerHeight
      // reduced motion: every entrance becomes a short fade
      const fx = (targets: gsap.TweenTarget, from: gsap.TweenVars, to: gsap.TweenVars, time: number) =>
        reduced ? t.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: 0.25 }, time) : t.fromTo(targets, from, to, time)
      const shake = (i: number, time: number, k = 1) => {
        if (!reduced) t.fromTo(S(i, '.sb-sheet'), { x: 9 * k }, { x: 0, duration: 0.32, ease: 'power3.out', immediateRender: false }, time)
      }
      const draw = (targets: gsap.TweenTarget, time: number, duration = 0.6) =>
        fx(targets, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration, ease: 'power2.inOut' }, time)
      const write = (targets: gsap.TweenTarget, time: number, duration: number) =>
        fx(targets, { clipPath: 'inset(-30% 100% -30% 0%)' }, { clipPath: 'inset(-30% 0% -30% 0%)', duration, ease: 'power1.inOut' }, time)
      const stamp = (i: number, targets: gsap.TweenTarget, time: number, r: number) => {
        fx(targets, { opacity: 0, scale: 2.3, rotate: r - 12 }, { opacity: 1, scale: 1, rotate: r, duration: 0.17, ease: 'power4.in' }, time)
        shake(i, time + 0.16)
      }
      const brush = (targets: gsap.TweenTarget, time: number, duration = 0.8) =>
        fx(
          targets,
          { clipPath: 'polygon(0% 0%, 0% 0%, -20% 100%, 0% 100%)' },
          { clipPath: 'polygon(0% 0%, 120% 0%, 100% 100%, 0% 100%)', duration, ease: 'power2.inOut' },
          time,
        )

      // ---- the cuts ---------------------------------------------------------
      SHEETS.forEach((sheet, i) => {
        const el = S(i)
        const next = SHEETS[i + 1]
        t.set(el, { autoAlpha: 1 }, sheet.from)
        if (next) t.set(el, { autoAlpha: 0 }, next.from)
        if (!reduced && i > 0 && !WIPES.has(i)) {
          // a page turn: the new sheet lands with a slight tilt
          t.fromTo(S(i, '.sb-sheet'), { yPercent: 4, rotate: -0.8 }, { yPercent: 0, rotate: 0, duration: 0.5, ease: 'expo.out' }, sheet.from)
        }
        if (!reduced && WIPES.has(i)) {
          const bands = q('.sb-wipe i')
          t.set(bands, { scaleX: 0, transformOrigin: 'left center' }, sheet.from - 0.3)
            .to(bands, { scaleX: 1, duration: 0.24, ease: 'power3.in', stagger: 0.035 }, sheet.from - 0.3)
            .set(bands, { transformOrigin: 'right center' }, sheet.from + 0.02)
            .to(bands, { scaleX: 0, duration: 0.36, ease: 'power3.out', stagger: 0.035 }, sheet.from + 0.04)
        }
      })

      // ---- 01 Hellooo… a sunburst, the vowel held, two chuckles -------------
      {
        const end = SHEETS[1].from
        fx(S(0, '.sb-sun'), { scale: 0.15, rotate: -60, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 1.3, ease: 'expo.out' }, 0)
        if (!reduced) t.to(S(0, '.sb-sun'), { rotate: 24, duration: end - 1.3, ease: 'none' }, 1.3)
        fx(
          S(0, '.sb-hello .sb-ch'),
          { yPercent: 120, rotate: (k: number) => (k % 2 ? 14 : -14), opacity: 0 },
          { yPercent: 0, rotate: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.7)', stagger: 0.05 },
          at('hello', 0),
        )
        if (!reduced) t.to(S(0, '.sb-hello .sb-o'), { x: (k: number) => (k + 1) * vw * 0.012, duration: e('hello', 0) - 0.5, ease: 'sine.inOut' }, 0.5)
        fx(S(0, '.sb-ha'), { scale: 0, rotate: -30, opacity: 0 }, { scale: 1, rotate: (k: number) => [-10, 12][k], opacity: 1, duration: 0.3, ease: 'back.out(2.2)', stagger: 0.18 }, 1.2)
      }

      // ---- 02 You / finally / found us. — rubber stamps ---------------------
      stamp(1, S(1, '.sb-stamp-you'), at('hello', 1), -8)
      stamp(1, S(1, '.sb-stamp-finally'), at('hello', 2), 2)
      stamp(1, S(1, '.sb-stamp-found'), at('hello', 3), -5)
      draw(S(1, '.sb-underline path'), e('hello', 4) - 0.3, 0.4)

      // ---- 03 Let's make your DREAM KITCHEN happen. --------------------------
      write(S(2, '.sb-lets'), at('kitchen', 0), s('kitchen', 3) - s('kitchen', 0))
      fx(S(2, '.sb-dream'), { yPercent: 40, skewX: -10, opacity: 0 }, { yPercent: 0, skewX: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, at('kitchen', 3))
      draw(S(2, '.sb-circle path'), s('kitchen', 3) + 0.04, 0.5)
      fx(
        S(2, '.sb-tile'),
        { yPercent: -340, rotate: (k: number) => (k % 2 ? 30 : -26), opacity: 0 },
        { yPercent: 0, rotate: (k: number) => [-4, 3, -2, 5, -3, 2, -5][k], opacity: 1, duration: 0.6, ease: 'back.out(1.4)', stagger: 0.045 },
        at('kitchen', 4),
      )
      fx(S(2, '.sb-print-a'), { y: -80, rotate: 16, opacity: 0 }, { y: 0, rotate: 4, opacity: 1, duration: 0.8, ease: 'expo.out' }, at('kitchen', 4) + 0.05)
      stamp(2, S(2, '.sb-happen'), at('kitchen', 5), -6)

      // ---- 04 Or other FURNITURE, for that matter. — split-flap ---------------
      fx(S(3, '.sb-or'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at('other', 0))
      fx(S(3, '.sb-cell'), { scaleY: 0.2, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.3, ease: 'power3.out', stagger: 0.03 }, at('other', 1))
      fx(S(3, '.sb-reel'), { yPercent: 0 }, { yPercent: -80, duration: 0.5, ease: 'steps(4)', stagger: 0.05 }, at('other', 2))
      fx(S(3, '.sb-print-b'), { x: -vw * 0.25, rotate: -20, opacity: 0 }, { x: 0, rotate: -5, opacity: 1, duration: 0.8, ease: 'expo.out' }, at('other', 2))
      write(S(3, '.sb-matter'), at('other', 3), e('other', 5) - s('other', 3))

      // ---- 05 Just nothing UPHOLSTERED. No, no, no… ---------------------------
      fx(S(4, '.sb-print-c'), { y: 60, rotate: -9, opacity: 0 }, { y: 0, rotate: -3, opacity: 1, duration: 0.7, ease: 'expo.out' }, at('sofa', 0))
      fx(S(4, '.sb-just'), { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, at('sofa', 0))
      stamp(4, S(4, '.sb-uph'), at('sofa', 2), -7)
      draw(S(4, '.sb-scribble path'), 9.12, 0.32)
      if (!reduced) t.to(S(4, '.sb-upholstery'), { opacity: 0.28, scale: 0.94, duration: 0.3, ease: 'power2.out' }, at('sofa', 3) - 0.05)
      S(4, '.sb-no').forEach((el, k) => {
        fx(el, { opacity: 0, scale: 3.2, rotate: [-14, 10, -6][k] * 2 }, { opacity: 1, scale: 1, rotate: [-14, 10, -6][k], duration: 0.14, ease: 'power4.in' }, at('sofa', 3 + k))
        shake(4, at('sofa', 3 + k) + 0.13, 1 + k * 0.4)
      })
      fx(S(4, '.sb-ha'), { scale: 0, rotate: -30, opacity: 0 }, { scale: 1, rotate: (k: number) => [8, -12][k], opacity: 1, duration: 0.3, ease: 'back.out(2.2)', stagger: 0.22 }, 10.44)

      // ---- 06 So… what are you looking for? — a typed index card -------------
      fx(S(5, '.sb-card'), { yPercent: 40, rotate: -8, opacity: 0 }, { yPercent: 0, rotate: -2, opacity: 1, duration: 0.6, ease: 'expo.out' }, SHEETS[5].from)
      {
        const so = S(5, '.sb-so .sb-ch')
        fx(so, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.09 }, at('ask', 0))
        const what = S(5, '.sb-what .sb-ch')
        fx(what, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: (e('ask', 5) - s('ask', 1)) / what.length }, at('ask', 1))
      }
      draw(S(5, '.sb-qmark path'), at('ask', 4), 0.55)
      fx(S(5, '.sb-qmark circle'), { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.25, ease: 'back.out(3)' }, e('ask', 5) - 0.1)

      // ---- 07 A kitchen? — pencil sketch brushed into colour ------------------
      fx(S(6, '.sb-sketched'), { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'expo.out' }, SHEETS[6].from)
      brush(S(6, '.sb-sketched-colour'), at('perhaps', 1), 0.75)
      fx(S(6, '.sb-label'), { scale: 0.4, rotate: -16, opacity: 0 }, { scale: 1, rotate: -3, opacity: 1, duration: 0.4, ease: 'back.out(1.8)' }, at('perhaps', 0))

      // ---- 08 Or perhaps… a different COLOUR? — a fan of chips ---------------
      write(S(7, '.sb-perhaps'), at('perhaps', 2), e('perhaps', 3) - s('perhaps', 2))
      fx(S(7, '.sb-different'), { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'expo.out' }, at('perhaps', 4))
      fx(
        S(7, '.sb-fan i'),
        { rotate: 0, opacity: 0 },
        { rotate: (k: number) => (k - 3) * 13, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: 0.03 },
        at('perhaps', 6) - 0.1,
      )
      fx(
        S(7, '.sb-colour-word .sb-ch'),
        { yPercent: -160, rotate: (k: number) => (k % 2 ? 24 : -20), opacity: 0 },
        { yPercent: 0, rotate: (k: number) => [-6, 4, -3, 6, -4, 3, 0][k] ?? 0, opacity: 1, duration: 0.55, ease: 'back.out(1.6)', stagger: 0.05 },
        at('perhaps', 6),
      )

      // ---- 09 Forest green… warm white… a little greige? — swatch cards -------
      {
        const times = [at('colours', 0), at('colours', 2), at('colours', 4)]
        const chips = S(8, '.sb-chip')
        const caps = S(8, '.sb-cap')
        times.forEach((time, k) => {
          fx(
            chips[k],
            { yPercent: 130, rotate: (k - 1) * 9 + 14, opacity: 0 },
            { yPercent: 0, rotate: (k - 1) * 6, opacity: 1, duration: 0.75, ease: 'expo.out' },
            time,
          )
          const colour = chips[k]?.querySelector('.sb-sketched-colour')
          if (colour) brush(colour, time + 0.35, 0.7)
          fx(caps[k], { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, time)
          if (k > 0 && !reduced) t.to(caps[k - 1], { yPercent: -60, opacity: 0, duration: 0.3, ease: 'power2.in' }, time - 0.05)
        })
      }

      // ---- 10 We've got PLENTY to choose from. Don't worry. — mood board -----
      fx(S(9, '.sb-wevegot'), { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }, at('plenty', 0))
      fx(
        S(9, '.sb-plenty .sb-ch'),
        { yPercent: 110, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out', stagger: 0.04 },
        at('plenty', 2),
      )
      if (!reduced) t.fromTo(S(9, '.sb-plenty'), { '--d': 0 }, { '--d': 1, duration: 0.7, ease: 'power3.out' }, at('plenty', 2) + 0.2)
      fx(
        S(9, '.sb-board .sb-print'),
        { y: () => -window.innerHeight * 0.9, rotate: (k: number) => BOARD[k].r * 4, opacity: 0 },
        { y: 0, rotate: (k: number) => BOARD[k].r, opacity: 1, duration: 0.7, ease: 'back.out(1.2)', stagger: 0.07 },
        at('plenty', 2) + 0.06,
      )
      fx(S(9, '.sb-choose'), { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'expo.out' }, at('plenty', 3))
      write(S(9, '.sb-worry'), at('plenty', 6), e('plenty', 7) - s('plenty', 6) + 0.1)
      if (!reduced) t.to(S(9, '.sb-board'), { y: 14, scale: 0.98, duration: 1.4, ease: 'sine.inOut' }, at('plenty', 6))

      // ---- 11 All right, all right… I'll give you some SPACE. ----------------
      write(S(10, '.sb-allright'), at('space', 0), e('space', 3) - s('space', 0))
      fx(S(10, '.sb-give'), { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'expo.out' }, at('space', 4))
      {
        const letters = S(10, '.sb-space .sb-ch')
        const mid = (letters.length - 1) / 2
        fx(letters, { yPercent: 90, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'expo.out', stagger: 0.03 }, at('space', 8))
        // the letters move apart and a draughtsman's dimension measures the gap
        if (!reduced) t.to(letters, { x: (k: number) => (k - mid) * vw * (portrait ? 0.035 : 0.05), duration: 0.7, ease: 'power3.out' }, at('space', 8) + 0.12)
        fx(S(10, '.sb-dimension'), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power3.out' }, at('space', 8) + 0.22)
        fx(S(10, '.sb-dim-label'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }, at('space', 8) + 0.42)
      }

      // ---- 12 Have a look AROUND. See what feels like HOME. -------------------
      {
        fx(S(11, '.sb-look'), { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'expo.out' }, at('home', 0))
        fx(S(11, '.sb-orbit'), { scale: 0.5, rotate: -200, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, at('home', 3) - 0.2)
        if (!reduced) t.to(S(11, '.sb-orbit'), { rotate: 70, duration: s('home', 4) - s('home', 3), ease: 'none' }, at('home', 3) + 0.7)
        if (!reduced) t.to(S(11, '.sb-around-scene'), { scale: 0.2, opacity: 0, duration: 0.45, ease: 'power3.in' }, at('home', 4) - 0.1)
        draw(S(11, '.sb-house path'), at('home', 4), 1.1)
        write(S(11, '.sb-see'), at('home', 4), e('home', 7) - s('home', 4))
        fx(S(11, '.sb-sun'), { scale: 0.1, rotate: -90, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 1.4, ease: 'expo.out' }, at('home', 8) - 0.1)
        if (!reduced) t.to(S(11, '.sb-sun'), { rotate: 30, duration: END - at('home', 8) - 1.2, ease: 'none' }, at('home', 8) + 1.3)
        fx(
          S(11, '.sb-home .sb-ch'),
          { yPercent: 120, rotate: (k: number) => (k % 2 ? 12 : -12), opacity: 0 },
          { yPercent: 0, rotate: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.05 },
          at('home', 8),
        )
      }

      // HOME holds for a breath before the room takes over.
      t.to({}, { duration: 0.01 }, END)
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
    // The voice ends a beat before the timeline: hand over to its own clock.
    const onEnded = () => {
      driver.current = 'clock'
      t.play()
    }
    gsap.ticker.add(sync)
    a?.addEventListener('ended', onEnded)
    return () => {
      gsap.ticker.remove(sync)
      a?.removeEventListener('ended', onEnded)
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
    <section ref={root} className="sketchbook" aria-label="Opening, the sketchbook">
      <p className="sr-only">{LINES.map((l) => l.text).join(' ')}</p>
      <span className="sb-crop sb-crop-tl" aria-hidden="true" />
      <span className="sb-crop sb-crop-tr" aria-hidden="true" />
      <span className="sb-crop sb-crop-bl" aria-hidden="true" />
      <span className="sb-crop sb-crop-br" aria-hidden="true" />

      <div className="sb-scenes" aria-hidden="true">
        {/* 01 */}
        <Sheet i={0}>
          <div className="sb-sun" />
          <h2 className="sb-display sb-hello">
            {[...'Hellooo…'].map((c, k) => (
              <span key={k} className={`sb-ch${k >= 4 ? ' sb-o' : ''}`}>
                {c}
              </span>
            ))}
          </h2>
          <span className="sb-ha sb-ha-1">ha</span>
          <span className="sb-ha sb-ha-2">ha!</span>
        </Sheet>

        {/* 02 */}
        <Sheet i={1}>
          <span className="sb-stamp sb-stamp-you">You</span>
          <span className="sb-stamp sb-stamp-finally">finally</span>
          <span className="sb-stamp sb-stamp-round sb-stamp-found">
            found us.
            <svg className="sb-underline" viewBox="0 0 300 30" preserveAspectRatio="none">
              <path pathLength="1" d="M6 18 C 80 8, 180 26, 294 12" />
            </svg>
          </span>
        </Sheet>

        {/* 03 */}
        <Sheet i={2}>
          <div className="sb-dream-block">
            <p className="sb-hand sb-lets">Let&apos;s make your</p>
            <h2 className="sb-display sb-dream">
              dream
              <svg className="sb-circle" viewBox="0 0 400 160" preserveAspectRatio="none">
                <path pathLength="1" d="M30 92 C 18 30, 180 6, 300 18 C 392 28, 396 122, 300 142 C 200 160, 58 150, 34 102 C 26 82, 52 50, 96 42" />
              </svg>
            </h2>
            <div className="sb-tiles">
              {[...'KITCHEN'].map((c, k) => (
                <span key={k} className="sb-tile" data-c={k % 4}>
                  {c}
                </span>
              ))}
            </div>
            <span className="sb-stamp sb-stamp-sm sb-happen">happen.</span>
          </div>
          <Print src={u('station')} className="sb-print-a" />
        </Sheet>

        {/* 04 */}
        <Sheet i={3}>
          <Print src={u('wardrobe')} className="sb-print-b" polaroid />
          <div className="sb-flap-block">
            <p className="sb-mono sb-or">or other</p>
            <div className="sb-flap">
              {[...FLAP].map((c, k) => (
                <span key={k} className="sb-cell">
                  <span className="sb-reel">
                    {[0, 1, 2, 3].map((n) => (
                      <span key={n}>{FLAP_NOISE[(k * 5 + n * 3) % FLAP_NOISE.length]}</span>
                    ))}
                    <span>{c}</span>
                  </span>
                </span>
              ))}
            </div>
            <p className="sb-hand sb-matter">for that matter.</p>
          </div>
        </Sheet>

        {/* 05 */}
        <Sheet i={4}>
          <div className="sb-upholstery">
            <p className="sb-display sb-just">Just nothing</p>
            <div className="sb-sofa">
              <Print src={u('sofa')} className="sb-print-c" />
              <span className="sb-stamp sb-stamp-red sb-uph">upholstered.</span>
              <svg className="sb-scribble" viewBox="0 0 400 200" preserveAspectRatio="none">
                <path pathLength="1" d="M10 70 L80 34 L40 128 L150 44 L112 166 L232 52 L194 172 L312 62 L272 162 L392 84" />
              </svg>
            </div>
          </div>
          <span className="sb-display sb-no sb-no-1">No,</span>
          <span className="sb-display sb-no sb-no-2">no,</span>
          <span className="sb-display sb-no sb-no-3">no…</span>
          <span className="sb-ha sb-ha-3">ha</span>
          <span className="sb-ha sb-ha-4">ha ha</span>
        </Sheet>

        {/* 06 */}
        <Sheet i={5}>
          <div className="sb-card">
            <p className="sb-type sb-so">
              <Chars text="So…" />
            </p>
            <p className="sb-type sb-what">
              <Chars text="what are you looking for?" />
              <span className="sb-caret" />
            </p>
            <span className="sb-card-meta">Brief · No. 001</span>
          </div>
          <svg className="sb-qmark" viewBox="0 0 200 300">
            <path pathLength="1" d="M48 92 C 46 28, 152 22, 156 86 C 160 142, 100 140, 100 192 L 100 216" />
            <circle cx="100" cy="262" r="12" />
          </svg>
        </Sheet>

        {/* 07 */}
        <Sheet i={6}>
          <Sketched src={u('shelves')} className="sb-sketched-a" />
          <span className="sb-label">
            <span className="sb-display">A kitchen?</span>
          </span>
        </Sheet>

        {/* 08 */}
        <Sheet i={7}>
          <div className="sb-fan" aria-hidden="true">
            {RETRO.map((c) => (
              <i key={c} style={{ background: c }} />
            ))}
          </div>
          <div className="sb-colour-block">
            <p className="sb-hand sb-perhaps">Or perhaps…</p>
            <p className="sb-display sb-different">a different</p>
            <h2 className="sb-display sb-colour-word">
              <Chars text="colour?" style={(k) => ({ color: RETRO[k % RETRO.length] })} />
            </h2>
          </div>
        </Sheet>

        {/* 09 */}
        <Sheet i={8}>
          <div className="sb-chips">
            {(
              [
                ['forest', '#3e5848', 'KG 01', 'Forest green'],
                ['white', '#efe9dd', 'KG 02', 'Warm white'],
                ['greige', '#b3aa9b', 'KG 03', 'Greige'],
              ] as const
            ).map(([key, colour, code, name], k) => (
              <div key={key} className="sb-chip" data-k={k} style={{ '--chip': colour } as CSSProperties}>
                <Sketched src={u(key)} className="sb-chip-photo" />
                <div className="sb-chip-band">
                  <span>{code}</span>
                  <b>{name}</b>
                </div>
              </div>
            ))}
          </div>
          <div className="sb-caps">
            <p className="sb-display sb-cap">Forest green…</p>
            <p className="sb-display sb-cap">warm white…</p>
            <p className="sb-display sb-cap">a little greige?</p>
          </div>
        </Sheet>

        {/* 10 */}
        <Sheet i={9}>
          <div className="sb-board">
            {BOARD.map((b) => (
              <Print
                key={b.key}
                src={u(b.key)}
                className="sb-board-print"
                style={{ left: `${b.l}%`, top: `${b.t}%`, '--w': b.w, aspectRatio: PHOTOS[b.key].ratio } as CSSProperties}
              />
            ))}
          </div>
          <div className="sb-plenty-block">
            <p className="sb-mono sb-wevegot">We&apos;ve got</p>
            <h2 className="sb-display sb-plenty">
              <Chars text="plenty" />
            </h2>
            <p className="sb-mono sb-choose">to choose from.</p>
            <p className="sb-hand sb-worry">Don&apos;t worry.</p>
          </div>
        </Sheet>

        {/* 11 */}
        <Sheet i={10}>
          <div className="sb-space-block">
            <p className="sb-hand sb-allright">All right, all right…</p>
            <p className="sb-display sb-give">I&apos;ll give you some</p>
            <div className="sb-space">
              <h2 className="sb-display sb-space-word">
                <Chars text="SPACE" />
              </h2>
              <svg className="sb-dimension" viewBox="0 0 1000 40" preserveAspectRatio="none">
                <path d="M0 20 L1000 20 M0 6 L0 34 M1000 6 L1000 34 M0 20 L22 11 M0 20 L22 29 M1000 20 L978 11 M1000 20 L978 29" />
              </svg>
              <span className="sb-mono sb-dim-label">≈ 6.40 m of it</span>
            </div>
          </div>
        </Sheet>

        {/* 12 */}
        <Sheet i={11}>
          <div className="sb-sun" />
          <div className="sb-around-scene">
            <p className="sb-display sb-look">Have a look</p>
            <div className="sb-orbit">
              <svg viewBox="0 0 400 400">
                <defs>
                  <path id="sb-around-path" d="M200,200 m-150,0 a150,150 0 1,1 300,0 a150,150 0 1,1 -300,0" />
                </defs>
                <text>
                  <textPath href="#sb-around-path" textLength="938" lengthAdjust="spacing">
                    AROUND · AROUND · AROUND ·
                  </textPath>
                </text>
              </svg>
              {ORBIT.map((key, k) => (
                <img
                  key={key}
                  className="sb-orbit-photo"
                  src={u(key)}
                  alt=""
                  style={{ '--a': `${(k / ORBIT.length) * 360}deg` } as CSSProperties}
                />
              ))}
            </div>
          </div>
          <div className="sb-home-block">
            <p className="sb-hand sb-see">See what feels like</p>
            <div className="sb-house-wrap">
              <svg className="sb-house" viewBox="0 0 400 360">
                <path pathLength="1" d="M34 172 L200 36 L366 172 M78 142 L78 332 L322 332 L322 142 M170 332 L170 246 L230 246 L230 332 M266 96 L266 50 L300 50 L300 124" />
              </svg>
              <h2 className="sb-display sb-home">
                <Chars text="home." />
              </h2>
            </div>
          </div>
        </Sheet>
      </div>

      <div className="sb-wipe" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="sb-controls">
        <button type="button" className="sb-control" onClick={toggleSound} aria-pressed={sound}>
          {sound ? 'Sound on' : 'Sound off'}
        </button>
        {!ended && (
          <button type="button" className="sb-control" onClick={skip}>
            Skip
          </button>
        )}
      </div>
    </section>
  )
}
