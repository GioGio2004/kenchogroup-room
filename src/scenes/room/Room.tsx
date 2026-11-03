import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'
import { boilFrame, buildRoom, type SketchModel } from '@/scenes/room/sketch'
import '@/styles/room.css'

const MAIN = import.meta.env.VITE_MAIN_SITE_URL ?? 'https://kenchogroup.ge'
const PAPER = '#f4f2ec'
/* Hand-drawn "boil": a few wobble frames cycled like drawn animation. */
const BOIL_FRAMES = 3
const BOIL_MS = 150
const DRAW_SECONDS = 4.6

type Look = { x: number; y: number }

function Sketch({ model, drawn }: { model: SketchModel; drawn: MutableRefObject<number> }) {
  const size = useThree((s) => s.size)
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const dark = useRef<THREE.Mesh>(null)

  const material = useMemo(
    () => new LineMaterial({ vertexColors: true, linewidth: 1.6, worldUnits: false }),
    [],
  )
  const frames = useMemo(
    () =>
      Array.from({ length: BOIL_FRAMES }, (_, i) => {
        const { positions, colors } = boilFrame(model.strokes, 101 + i * 37)
        const g = new LineSegmentsGeometry()
        g.setPositions(positions)
        g.setColors(colors)
        g.instanceCount = 0
        return g
      }),
    [model],
  )
  const total = useMemo(() => frames[0].attributes.instanceStart.count, [frames])
  const lines = useMemo(() => frames.map((g) => new LineSegments2(g, material)), [frames, material])

  useEffect(() => {
    material.resolution.set(size.width, size.height)
  }, [material, size])

  useEffect(
    () => () => {
      frames.forEach((g) => g.dispose())
      material.dispose()
    },
    [frames, material],
  )

  useFrame(({ clock }) => {
    const frame = reduced ? 0 : Math.floor((clock.elapsedTime * 1000) / BOIL_MS) % BOIL_FRAMES
    const count = Math.floor(drawn.current * total)
    lines.forEach((l, i) => {
      l.visible = i === frame
      l.geometry.instanceCount = count
    })
    // Solid ink (the TV) only once the strokes around it are down.
    if (dark.current) dark.current.visible = drawn.current > 0.62
  })

  return (
    <>
      <mesh geometry={model.fills} renderOrder={0}>
        <meshBasicMaterial color={PAPER} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <mesh ref={dark} geometry={model.darkFills} renderOrder={0} visible={false}>
        <meshBasicMaterial color="#26241f" polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </>
  )
}

/* The camera glides in during the drawing, then leans after the pointer. */
function Rig({ look, arrive }: { look: MutableRefObject<Look>; arrive: MutableRefObject<number> }) {
  const cur = useRef(new THREE.Vector3(0, 1.1, -1.6))
  const pos = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }, dt) => {
    const k = 1 - Math.pow(0.0025, dt)
    const a = arrive.current
    const { x, y } = look.current
    // Portrait screens: a wider lens and a step back, so the room still fits.
    const portrait = size.width < size.height
    const cam = camera as THREE.PerspectiveCamera
    const fov = portrait ? 64 : 42
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const back = portrait ? 1.6 : 0
    const reach = portrait ? 2.2 : 1.3
    pos.set(0.4 + x * reach, 1.55 + y * 0.45 + (1 - a) * 1.1, 6.3 + back + (1 - a) * 3.2)
    camera.position.lerp(pos, k)
    target.set(-0.25 + x * 0.6, 1.05 + y * 0.25, -1.6)
    cur.current.lerp(target, k)
    camera.lookAt(cur.current)
  })
  return null
}

/*
 * Keeps each DOM label glued to its point in the room: projects the
 * anchors to screen space every frame (no extra React roots).
 */
function Pins({ model, pins }: { model: SketchModel; pins: MutableRefObject<Array<HTMLElement | null>> }) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    TAGS.forEach((t, i) => {
      const el = pins.current[i]
      if (!el) return
      v.copy(model.anchors[t.key]).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15
      el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0)`
      el.style.visibility = visible ? 'visible' : 'hidden'
    })
  })
  return null
}

const TAGS = [
  { key: 'gallery', n: '01', title: 'Kitchens & interiors', cta: 'Gallery', href: '/en/gallery', side: 'right' },
  { key: 'about', n: '02', title: 'Through the workshop door', cta: 'About us', href: '/en/about', side: 'right' },
  { key: 'contact', n: '03', title: 'Your wall, your idea', cta: 'Contacts', href: '/en/contact', side: 'left' },
] as const

/*
 * The landing room: a hand-drawn living room with the kitchen, sketched
 * live in three.js. It draws itself in stroke by stroke, then the lines
 * boil gently and the camera follows the pointer (or a drag on touch).
 */
export default function Room({ onReplay }: { onReplay: () => void }) {
  const root = useRef<HTMLElement>(null)
  const model = useMemo(() => buildRoom(), [])
  const drawn = useRef(0)
  const arrive = useRef(0)
  const look = useRef<Look>({ x: 0, y: 0 })
  const pins = useRef<Array<HTMLElement | null>>([])
  const [labels, setLabels] = useState(false)
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  useGSAP(
    () => {
      const reduced = prefersReducedMotion()
      if (reduced) {
        drawn.current = 1
        arrive.current = 1
        setLabels(true)
        return
      }
      gsap
        .timeline()
        .fromTo(root.current, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath' })
        .to(drawn, { current: 1, duration: DRAW_SECONDS, ease: 'power1.inOut', onComplete: () => setLabels(true) }, 0.5)
        .to(arrive, { current: 1, duration: DRAW_SECONDS + 0.8, ease: 'power2.inOut' }, 0.5)
        .from('.room-ui > *', { opacity: 0, y: 12, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, DRAW_SECONDS - 0.4)
    },
    { scope: root },
  )

  // Desktop: the room leans after the mouse. Touch: drag to look around.
  useEffect(() => {
    let dragging = false
    let last = { x: 0, y: 0 }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        look.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) }
        return
      }
      if (!dragging) return
      const dx = (e.clientX - last.x) / window.innerWidth
      const dy = (e.clientY - last.y) / window.innerHeight
      last = { x: e.clientX, y: e.clientY }
      look.current = { x: clamp(look.current.x - dx * 2.4), y: clamp(look.current.y + dy * 2) }
    }
    const down = (e: PointerEvent) => {
      dragging = true
      last = { x: e.clientX, y: e.clientY }
    }
    const up = () => {
      dragging = false
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <section ref={root} className="room" aria-label="The room">
      <Canvas
        className="room-canvas"
        dpr={[1, 2]}
        camera={{ position: [0.4, 2.65, 9.5], fov: 42, near: 0.1, far: 60 }}
        flat
        gl={{ antialias: true, alpha: true }}
      >
        <Sketch model={model} drawn={drawn} />
        <Rig look={look} arrive={arrive} />
        <Pins model={model} pins={pins} />
      </Canvas>

      <div className="room-pins">
        {TAGS.map((t, i) => (
          <div
            key={t.key}
            className="room-pin"
            ref={(el) => {
              pins.current[i] = el
            }}
          >
            <a
              className="room-tag"
              data-side={t.side}
              data-on={labels || undefined}
              href={`${MAIN}${t.href}`}
              tabIndex={labels ? 0 : -1}
            >
              <span className="room-tag-dot" aria-hidden="true" />
              <span className="room-tag-body">
                <span className="room-tag-n">{t.n}</span>
                <span className="room-tag-title">{t.title}</span>
                <span className="room-tag-cta">
                  {t.cta} <span aria-hidden="true">↗</span>
                  <svg viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M2 6 C 30 2, 60 9, 118 4" />
                  </svg>
                </span>
              </span>
            </a>
          </div>
        ))}
      </div>

      <div className="room-grain" aria-hidden="true" />

      <div className="room-ui">
        <p className="room-mark">
          KENCHO <span>GROUP</span>
        </p>
        <button type="button" className="room-replay" onClick={onReplay}>
          Replay intro
        </button>
        <p className="room-hint">{touch ? 'Drag to look around' : 'Move to look around'}</p>
        <nav className="room-nav" aria-label="Kencho Group">
          <a href={`${MAIN}/en/gallery`}>Gallery</a>
          <a href={`${MAIN}/en/about`}>About us</a>
          <a href={`${MAIN}/en/contact`}>Contacts</a>
        </nav>
      </div>
    </section>
  )
}
