import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger, useGSAP, reduced } from '@/page/fx'
import { narrator } from '@/lib/narrator'
import { tracker } from '@/lib/tracker'
import Navbar, { type NavItem } from '@/nav/Navbar'
import Hero from '@/page/Hero'
import Manifesto from '@/page/Manifesto'
import Pieces from '@/page/Pieces'
import Finishes from '@/page/Finishes'
import Outro from '@/page/Outro'
import RoomFooter from '@/page/RoomFooter'
import { loadRoom } from '@/page/room-chunk'
import Cursor from '@/page/Cursor'
import '@/styles/page.css'

/*
 * The page after the opening: hero, what we do, what we
 * make, the palettes and an invitation; then the whole page lifts off like
 * a lid, and the footer underneath is the hand-drawn room, full screen. The
 * narrator keeps you company, a line per section, if the sound is on.
 */
const NAV: NavItem[] = [
  { id: 'pieces', label: 'What we make', note: 'Six things we make in wood' },
  { id: 'finishes', label: 'Palettes', note: 'Five colour schemes to start from' },
  { id: 'room', label: 'The room', note: 'The drawn room, under the page' },
]
const LINES: Array<[id: string, line: string]> = [
  ['pieces', 'page-pieces'],
  ['finishes', 'page-finishes'],
  ['outro', 'page-room'],
]

export default function Page({ sound, onSound, onReplay }: { sound: boolean; onSound: (on: boolean) => void; onReplay: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const [play, setPlay] = useState(false)

  // the narrator follows the switch
  useEffect(() => {
    narrator.setMuted(!sound)
    tracker.set({ voice: sound })
  }, [sound])

  // Arriving: a burst of colour rings out of the black and white, then the hero lands.
  useGSAP(
    () => {
      window.scrollTo(0, 0)
      ;(window as Window & { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis?.scrollTo(0, { immediate: true, force: true })
      if (reduced()) {
        setPlay(true)
        gsap.set('.burst', { autoAlpha: 0 })
        return
      }
      gsap
        .timeline()
        .fromTo('.burst i', { scale: 0 }, { scale: 1, duration: 1.15, stagger: 0.11, ease: 'expo.inOut' })
        .call(() => setPlay(true), [], 0.95)
        .to('.burst', { autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, 1.25)
    },
    { scope: root },
  )

  // Once in: a hello, the room's chunk on its way, and a line as each section arrives.
  useEffect(() => {
    if (!play) return
    const hello = window.setTimeout(() => void narrator.say('page-hello', { priority: 1 }), 900)
    const idle = window.setTimeout(() => void loadRoom(), 2500)
    const triggers = LINES.map(([id, line]) => {
      const el = document.getElementById(id)
      return el ? ScrollTrigger.create({ refreshPriority: -1, trigger: el, start: 'top 55%', once: true, onEnter: () => void narrator.say(line, { priority: 1 }) }) : null
    })
    // fonts and photos change the page's height: measure again once they are in
    const again = () => ScrollTrigger.refresh()
    void document.fonts?.ready.then(again)
    window.addEventListener('load', again)
    return () => {
      window.clearTimeout(hello)
      window.clearTimeout(idle)
      triggers.forEach((t) => t?.kill())
      window.removeEventListener('load', again)
    }
  }, [play])

  return (
    <div ref={root} className="page">
      <Navbar items={NAV} voice={sound} onVoice={() => onSound(!sound)} onReplay={onReplay} show={play} />
      <main className="page-main">
        <Hero play={play} />
        <Manifesto />
        <Pieces />
        <Finishes />
        <Outro />
      </main>
      <RoomFooter sound={sound} onReplay={onReplay} />
      <div className="page-grain" aria-hidden="true" />
      <Cursor />
      <div className="burst" aria-hidden="true">
        <i style={{ background: 'var(--terra)' }} />
        <i style={{ background: 'var(--mustard)' }} />
        <i style={{ background: 'var(--sage)' }} />
        <i style={{ background: 'var(--forest)' }} />
        <i style={{ background: 'var(--paper)' }} />
      </div>
    </div>
  )
}
