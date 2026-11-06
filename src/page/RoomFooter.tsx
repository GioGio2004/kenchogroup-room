import { lazy, Suspense, useRef, useState } from 'react'
import { gsap, ScrollTrigger, useGSAP, reduced } from '@/page/fx'
import { loadRoom } from '@/page/room-chunk'

const Room = lazy(loadRoom)

/*
 * The footer is the room: full screen, nothing on top of it. It waits
 * underneath the whole page, and the page lifts off it like a lid. It draws
 * itself the first time it is uncovered and sleeps whenever the lid comes
 * back down. Its TV (Contacts) books a meeting on the main site.
 */
export default function RoomFooter({ sound, onReplay }: { sound: boolean; onReplay: () => void }) {
  const root = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [active, setActive] = useState(false)

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const main = document.querySelector('.page-main')
      if (!main) return
      // (sitting under everything, the room is always "in view": the lid's
      // position is what says how much of it can actually be seen)
      ScrollTrigger.create({ refreshPriority: -1, trigger: main, start: 'bottom 300%', onEnter: () => setNear(true) })
      ScrollTrigger.create({
        refreshPriority: -1,
        trigger: main,
        start: 'bottom bottom',
        end: 'bottom top',
        onUpdate: (self) => setActive(self.progress > 0.4),
        onLeave: () => setActive(true),
        onLeaveBack: () => setActive(false),
      })
      if (reduced()) return
      const lift = { refreshPriority: -1, trigger: main, start: 'bottom bottom', end: 'bottom top', scrub: true }
      gsap.fromTo(q('.rf-veil'), { opacity: 0.6 }, { opacity: 0, ease: 'none', scrollTrigger: lift })
      gsap.fromTo(q('.rf-lift'), { yPercent: 16 }, { yPercent: 0, ease: 'none', scrollTrigger: lift })
    },
    { scope: root },
  )

  return (
    <footer ref={root} className="rf" id="room" aria-label="The room">
      <div className="rf-lift">
        {near ? (
          <Suspense fallback={<p className="rf-wait">Sharpening the pencils…</p>}>
            <Room embedded active={active} sound={sound} look="sketch" onReplay={onReplay} />
          </Suspense>
        ) : (
          <p className="rf-wait">Sharpening the pencils…</p>
        )}
      </div>
      <div className="rf-veil" aria-hidden="true" />
    </footer>
  )
}
