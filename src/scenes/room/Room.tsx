import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'
import {
  buildRoom,
  FILL_KEYS,
  inkLines,
  KITCHEN_PARTS,
  KITCHEN_THEMES,
  PAPER,
  ROOM_COLORS,
  type FillKey,
  type KitchenPart,
  type KitchenTheme,
  type Layer,
  type SketchModel,
  type Zone,
} from '@/scenes/room/sketch'
import '@/styles/room.css'

const MAIN = import.meta.env.VITE_MAIN_SITE_URL ?? 'https://kenchogroup.ge'
const DRAW_SECONDS = 4.4
const FINISH_KEY = 'kencho-room-finish'
/* Above this width the design board sits on the right; below, it is a bottom sheet. */
const BOARD_BREAK = 860
const ZONES: Zone[] = ['kitchen', 'door', 'media']

const PAPER_C = new THREE.Color(PAPER)
const WHITE = new THREE.Color('#ffffff')
const TV_ON = new THREE.Color('#6d7f72')
/* Face shading fades in with the washes, so the bare paper stage stays flat white. */
const SHADE = { value: 0 }

function washMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: PAPER, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShade = SHADE
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uShade;\nvoid main() {')
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb = mix(vec3(1.0), vColor.rgb, uShade);')
  }
  m.customProgramCacheKey = () => 'room-wash'
  return m
}

type Look = { x: number; y: number }
type Mats = Record<FillKey, THREE.MeshBasicMaterial>
type Colors = Record<FillKey, THREE.Color>

/* Everything the render loop reads, tweened by GSAP from the outside. */
interface Live {
  drawn: number
  wash: number
  arrive: number
  focus: number
  door: number
  look: Look
  hot: Record<Zone, number>
}

interface NavItem {
  key: string
  anchor: string
  /** where the label sits, as a fraction of the viewport away from its dot */
  off: [number, number]
  n: string
  title: string
  cta: string
  href?: string
  zone?: Zone
}

interface NoteItem {
  key: string
  anchor: string
  off: [number, number]
  part: Exclude<KitchenPart, 'shelf'>
  label: string
}

const NAV: NavItem[] = [
  { key: 'kitchen', anchor: 'kitchen', off: [-0.01, -0.15], n: '01', title: 'Your dream kitchen', cta: 'Design it', zone: 'kitchen' },
  { key: 'gallery', anchor: 'gallery', off: [0.02, 0.3], n: '02', title: 'Kitchens & interiors', cta: 'Gallery', href: '/en/gallery' },
  { key: 'about', anchor: 'about', off: [0.03, -0.2], n: '03', title: 'Through the workshop door', cta: 'About us', href: '/en/about', zone: 'door' },
  { key: 'contact', anchor: 'contact', off: [-0.01, 0.27], n: '04', title: 'Your wall, your idea', cta: 'Contacts', href: '/en/contact', zone: 'media' },
]

const NOTES: NoteItem[] = [
  { key: 'cabinets', anchor: 'cabinets', off: [-0.02, -0.13], part: 'cabinets', label: 'Wall & tall units' },
  { key: 'tile', anchor: 'tile', off: [0.05, -0.2], part: 'tile', label: 'Splashback' },
  { key: 'worktop', anchor: 'worktop', off: [0.06, 0.13], part: 'worktop', label: 'Worktops' },
  { key: 'fronts', anchor: 'fronts', off: [-0.04, 0.17], part: 'fronts', label: 'Island & base run' },
]

const ITEMS = [...NAV.map((t) => ({ ...t, set: 'room' as const })), ...NOTES.map((t) => ({ ...t, set: 'note' as const }))]

function storedFinish() {
  try {
    return localStorage.getItem(FINISH_KEY) ?? KITCHEN_THEMES[0].id
  } catch {
    return KITCHEN_THEMES[0].id
  }
}

/* One layer of the drawing: its colour washes and its ink, drawn in stroke by stroke. */
function InkLayer({ layer, mats, live, from = 0, to = 1 }: { layer: Layer; mats: Mats; live: MutableRefObject<Live>; from?: number; to?: number }) {
  const size = useThree((s) => s.size)
  const line = useMemo(() => {
    const { positions, colors } = inkLines(layer.strokes)
    const g = new LineSegmentsGeometry()
    g.setPositions(positions)
    g.setColors(colors)
    g.instanceCount = 0
    return new LineSegments2(g, new LineMaterial({ vertexColors: true, linewidth: 1.5, worldUnits: false }))
  }, [layer])
  const total = line.geometry.attributes.instanceStart.count

  useEffect(() => {
    line.material.resolution.set(size.width, size.height)
  }, [line, size])

  useEffect(
    () => () => {
      line.geometry.dispose()
      line.material.dispose()
    },
    [line],
  )

  useFrame(() => {
    const p = THREE.MathUtils.clamp((live.current.drawn - from) / (to - from), 0, 1)
    line.geometry.instanceCount = Math.floor(p * total)
  })

  return (
    <>
      {(Object.entries(layer.fills) as Array<[FillKey, THREE.BufferGeometry]>).map(([key, g]) => (
        <mesh key={key} geometry={g} material={mats[key]} />
      ))}
      <primitive object={line} />
    </>
  )
}

/* Invisible volumes over the kitchen, the door and the media wall. */
function Zones({ model, enabled, onHot, onPick }: { model: SketchModel; enabled: boolean; onHot: (z: Zone, on: boolean) => void; onPick: (z: Zone) => void }) {
  return (
    <>
      {ZONES.map((z) => {
        const { min, max } = model.zones[z]
        return (
          <mesh
            key={z}
            position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}
            onPointerOver={(e) => {
              if (!enabled) return
              e.stopPropagation()
              onHot(z, true)
            }}
            onPointerOut={() => onHot(z, false)}
            onClick={(e) => {
              // a drag to look around is not a click
              if (!enabled || e.delta > 6) return
              e.stopPropagation()
              onPick(z)
            }}
          >
            <boxGeometry args={[max[0] - min[0], max[1] - min[1], max[2] - min[2]]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        )
      })}
    </>
  )
}

/*
 * The camera: glides in during the drawing, leans a little after the
 * pointer, and flies to the kitchen close-up as `focus` goes to 1. The lens
 * widens on narrower screens so the whole room stays in frame.
 */
function Rig({ live }: { live: MutableRefObject<Live> }) {
  const cur = useRef(new THREE.Vector3(-0.1, 1.1, -1.6))
  const v = useMemo(
    () => ({ roomPos: new THREE.Vector3(), roomLook: new THREE.Vector3(), focusPos: new THREE.Vector3(), focusLook: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3() }),
    [],
  )
  useFrame(({ camera, size }, dt) => {
    const L = live.current
    const k = 1 - Math.pow(0.03, Math.min(dt, 0.1))
    const aspect = size.width / size.height
    const portrait = aspect < 1
    const cam = camera as THREE.PerspectiveCamera
    const fov = portrait ? 62 : THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(0.72 / aspect)), 40, 56)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const back = portrait ? 1.8 : Math.max(0, (1.35 - aspect) * 4)
    const { x, y } = L.look
    const a = 1 - L.arrive
    // Touch drags pan wide; the mouse only nudges, so the drawing stays still.
    const reach = portrait ? 2 : 0.35
    v.roomPos.set(0.3 + x * reach, 1.6 + y * 0.12 + a * 0.8, 6 + back + a * 2.6)
    v.roomLook.set(-0.1 + x * (portrait ? 0.6 : 0.18), 1.16 + y * 0.08, -1.6)
    if (portrait) {
      v.focusPos.set(-1.7 + x * 0.8, 1.75, 1.3)
      v.focusLook.set(-1.7 + x * 0.5, 0.5, -3.4)
    } else {
      v.focusPos.set(-1.2 + x * 0.15, 1.85 + y * 0.05, 2.2 + back * 0.5)
      v.focusLook.set(-1.2 + x * 0.08, 1.2, -3.3)
    }
    v.pos.lerpVectors(v.roomPos, v.focusPos, L.focus)
    v.look.lerpVectors(v.roomLook, v.focusLook, L.focus)
    camera.position.lerp(v.pos, k)
    cur.current.lerp(v.look, k)
    camera.lookAt(cur.current)
  })
  return null
}

/*
 * Keeps the callouts glued to the room: each frame, a dot on its 3D anchor,
 * the label offset into clear space (kept on screen and off the board), and
 * a leader line from the dot to the label's nearest edge.
 */
function Projector({
  model,
  live,
  dots,
  labels,
  lines,
}: {
  model: SketchModel
  live: MutableRefObject<Live>
  dots: MutableRefObject<Array<HTMLElement | null>>
  labels: MutableRefObject<Array<HTMLElement | null>>
  lines: MutableRefObject<Array<SVGLineElement | null>>
}) {
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const W = size.width
    const H = size.height
    const desk = W > BOARD_BREAK
    const kitchen = live.current.focus > 0.5
    const maxX = kitchen && desk ? W - Math.min(380, W * 0.34) - 56 : W - 16
    const maxY = kitchen && !desk ? H * 0.54 : H - 70
    ITEMS.forEach((it, i) => {
      const dot = dots.current[i]
      const label = labels.current[i]
      const line = lines.current[i]
      if (!dot || !label || !line) return
      v.copy(model.anchors[it.anchor]).project(camera)
      const ax = ((v.x + 1) / 2) * W
      const ay = ((1 - v.y) / 2) * H
      const shown = v.z < 1 && ax > 0 && ax < W && ay > 0 && ay < H ? 'visible' : 'hidden'
      const w = label.offsetWidth
      const h = label.offsetHeight
      let lx = ax + it.off[0] * W - (it.off[0] < 0 ? w : 0)
      let ly = ay + it.off[1] * H - (it.off[1] < 0 ? h : 0)
      lx = Math.max(16, Math.min(lx, maxX - w))
      ly = Math.max(72, Math.min(ly, maxY - h))
      dot.style.transform = `translate3d(${ax}px, ${ay}px, 0)`
      label.style.transform = `translate3d(${lx}px, ${ly}px, 0)`
      line.setAttribute('x1', ax.toFixed(1))
      line.setAttribute('y1', ay.toFixed(1))
      line.setAttribute('x2', Math.max(lx, Math.min(ax, lx + w)).toFixed(1))
      line.setAttribute('y2', Math.max(ly, Math.min(ay, ly + h)).toFixed(1))
      dot.style.visibility = shown
      label.style.visibility = shown
      line.style.visibility = shown
    })
  })
  return null
}

/* The washes follow their target colours, plus hover lifts, the TV and the door. */
function Paint({ mats, targets, live, door }: { mats: Mats; targets: Colors; live: MutableRefObject<Live>; door: MutableRefObject<THREE.Group | null> }) {
  useFrame(() => {
    const L = live.current
    SHADE.value = L.wash
    for (const key of FILL_KEYS) mats[key].color.copy(PAPER_C).lerp(targets[key], L.wash)
    for (const part of KITCHEN_PARTS) mats[part].color.lerp(WHITE, L.hot.kitchen * 0.16)
    mats.tv.color.lerp(TV_ON, L.hot.media * L.wash)
    if (door.current) door.current.rotation.y = -(L.hot.door * 0.6 + L.door * 0.95)
  })
  return null
}

function ThemeChips({ theme }: { theme: KitchenTheme }) {
  return (
    <span className="board-chips" aria-hidden="true">
      {(['cabinets', 'fronts', 'worktop', 'tile'] as const).map((p) => (
        <i key={p} style={{ background: theme.colors[p] }} />
      ))}
    </span>
  )
}

/*
 * The landing room: a hand-drawn retro living room with the kitchen, drawn
 * in three.js like a designer's board. It inks itself in, the colour washes
 * follow, then it holds still: hover the kitchen, the door or the media
 * wall; click the kitchen to fly in close and change its finish.
 */
export default function Room({ onReplay }: { onReplay: () => void }) {
  const root = useRef<HTMLElement>(null)
  const board = useRef<HTMLElement>(null)
  const door = useRef<THREE.Group>(null)
  const model = useMemo(() => buildRoom(), [])
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const live = useRef<Live>({ drawn: 0, wash: 0, arrive: 0, focus: 0, door: 0, look: { x: 0, y: 0 }, hot: { kitchen: 0, door: 0, media: 0 } })
  const dots = useRef<Array<HTMLElement | null>>([])
  const labels = useRef<Array<HTMLElement | null>>([])
  const lines = useRef<Array<SVGLineElement | null>>([])
  const [ready, setReady] = useState(false)
  const [focus, setFocus] = useState(false)
  const [hot, setHot] = useState<Zone | null>(null)
  const [themeId, setThemeId] = useState(storedFinish)
  const theme = KITCHEN_THEMES.find((t) => t.id === themeId) ?? KITCHEN_THEMES[0]
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const mode = !ready ? 'off' : focus ? 'kitchen' : 'room'

  const [mats] = useState<Mats>(() => {
    const m = {} as Mats
    for (const key of FILL_KEYS) m[key] = washMaterial()
    return m
  })
  const [targets] = useState<Colors>(() => {
    const c = {} as Colors
    for (const [key, hex] of Object.entries(ROOM_COLORS) as Array<[FillKey, string]>) c[key] = new THREE.Color(hex)
    for (const part of KITCHEN_PARTS) c[part] = new THREE.Color(theme.colors[part])
    return c
  })

  useEffect(
    () => () => {
      for (const layer of [model.main, model.door]) Object.values(layer.fills).forEach((g) => g?.dispose())
      Object.values(mats).forEach((m) => m.dispose())
    },
    [model, mats],
  )

  useGSAP(
    () => {
      const L = live.current
      if (reduced) {
        Object.assign(L, { drawn: 1, wash: 1, arrive: 1 })
        setReady(true)
        return
      }
      gsap
        .timeline()
        .fromTo(root.current, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath' })
        .to(L, { drawn: 1, duration: DRAW_SECONDS, ease: 'power1.inOut', onComplete: () => setReady(true) }, 0.5)
        .to(L, { arrive: 1, duration: DRAW_SECONDS + 0.6, ease: 'power2.inOut' }, 0.5)
        .to(L, { wash: 1, duration: 1.8, ease: 'power2.out' }, 0.5 + DRAW_SECONDS * 0.6)
        .from('.room-ui > *', { opacity: 0, y: 12, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, DRAW_SECONDS - 0.4)
    },
    { scope: root },
  )

  // A new finish: each part of the kitchen re-washes in turn.
  useEffect(() => {
    KITCHEN_PARTS.forEach((part, i) => {
      const c = new THREE.Color(theme.colors[part])
      gsap.to(targets[part], { r: c.r, g: c.g, b: c.b, duration: reduced ? 0 : 0.9, delay: reduced ? 0 : i * 0.07, ease: 'power2.inOut', overwrite: true })
    })
    try {
      localStorage.setItem(FINISH_KEY, theme.id)
    } catch {
      // private mode: the finish just isn't remembered
    }
  }, [theme, targets, reduced])

  // Hover: the zone lifts, its callout answers, the door eases ajar, the TV wakes.
  useEffect(() => {
    for (const z of ZONES) gsap.to(live.current.hot, { [z]: hot === z ? 1 : 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
    if (root.current) root.current.style.cursor = hot ? 'pointer' : ''
  }, [hot])

  // The kitchen close-up.
  useEffect(() => {
    gsap.to(live.current, { focus: focus ? 1 : 0, duration: reduced ? 0.3 : 1.6, ease: 'power3.inOut', overwrite: 'auto' })
    if (!focus) return
    board.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, reduced])

  // Desktop: the room leans a touch after the mouse. Touch: drag to look around.
  useEffect(() => {
    let dragging = false
    let last = { x: 0, y: 0 }
    const L = live.current
    const clamp = (n: number) => Math.max(-1, Math.min(1, n))
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        L.look = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) }
        return
      }
      if (!dragging) return
      const dx = (e.clientX - last.x) / window.innerWidth
      const dy = (e.clientY - last.y) / window.innerHeight
      last = { x: e.clientX, y: e.clientY }
      L.look = { x: clamp(L.look.x - dx * 2.4), y: clamp(L.look.y + dy * 2) }
    }
    const down = (e: PointerEvent) => {
      dragging = e.target instanceof HTMLCanvasElement
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

  const go = (href: string) => window.location.assign(`${MAIN}${href}`)

  const enterFocus = () => {
    setHot(null)
    setFocus(true)
  }

  const leaveFocus = () => {
    setFocus(false)
    if (board.current?.contains(document.activeElement)) labels.current[0]?.focus({ preventScroll: true })
  }

  const pick = (z: Zone) => {
    if (z === 'kitchen') return enterFocus()
    setHot(z)
    if (z === 'door') {
      gsap.to(live.current, { door: 1, duration: reduced ? 0.01 : 0.8, ease: 'power3.inOut', onComplete: () => go('/en/about') })
      return
    }
    gsap.delayedCall(reduced ? 0 : 0.45, () => go('/en/contact'))
  }

  const onHot = (z: Zone, on: boolean) => setHot((h) => (on ? z : h === z ? null : h))

  // Plain clicks on About and Contacts play the door / TV first; modified clicks stay links.
  const onNavClick = (t: NavItem) => (e: MouseEvent) => {
    if (!t.zone) return
    if (t.zone === 'kitchen') return enterFocus()
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    pick(t.zone)
  }

  const onThemeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const n = KITCHEN_THEMES.length
    const i = (KITCHEN_THEMES.findIndex((t) => t.id === theme.id) + step + n) % n
    setThemeId(KITCHEN_THEMES[i].id)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus()
  }

  return (
    <section ref={root} className="room" data-focus={focus || undefined} aria-label="The room">
      <Canvas className="room-canvas" dpr={[1, 2]} camera={{ position: [0.3, 2.4, 9], fov: 44, near: 0.1, far: 60 }} flat gl={{ antialias: true, alpha: true }}>
        <InkLayer layer={model.main} mats={mats} live={live} />
        <group ref={door} position={model.hinge}>
          <InkLayer layer={model.door} mats={mats} live={live} from={0.5} to={0.75} />
        </group>
        <Paint mats={mats} targets={targets} live={live} door={door} />
        <Zones model={model} enabled={ready && !focus} onHot={onHot} onPick={pick} />
        <Rig live={live} />
        <Projector model={model} live={live} dots={dots} labels={labels} lines={lines} />
      </Canvas>

      <div className="room-callouts" data-mode={mode}>
        <svg className="room-leaders" aria-hidden="true">
          {ITEMS.map((it, i) => (
            <line
              key={it.key}
              data-set={it.set}
              data-hot={(it.set === 'room' && 'zone' in it && it.zone === hot) || undefined}
              ref={(el) => {
                lines.current[i] = el
              }}
            />
          ))}
        </svg>
        {ITEMS.map((it, i) => (
          <span
            key={it.key}
            className="callout-dot"
            data-set={it.set}
            data-hot={(it.set === 'room' && 'zone' in it && it.zone === hot) || undefined}
            ref={(el) => {
              dots.current[i] = el
            }}
            aria-hidden="true"
          />
        ))}
        {NAV.map((t, i) => {
          const body = (
            <span className="callout-body" style={{ '--i': i } as CSSProperties}>
              <span className="callout-n">{t.n}</span>
              <span className="callout-title">{t.title}</span>
              <span className="callout-cta">
                {t.cta} <span aria-hidden="true">{t.href ? '↗' : '→'}</span>
                <svg viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 6 C 30 2, 60 9, 118 4" />
                </svg>
              </span>
            </span>
          )
          const props = {
            className: 'callout',
            'data-set': 'room',
            'data-hot': (t.zone && t.zone === hot) || undefined,
            tabIndex: mode === 'room' ? 0 : -1,
            ref: (el: HTMLElement | null) => {
              labels.current[i] = el
            },
            onClick: onNavClick(t),
            onPointerEnter: () => t.zone && setHot(t.zone),
            onPointerLeave: () => t.zone && onHot(t.zone, false),
            onFocus: (e: FocusEvent<HTMLElement>) => t.zone && e.currentTarget.matches(':focus-visible') && setHot(t.zone),
            onBlur: () => t.zone && onHot(t.zone, false),
          }
          return t.href ? (
            <a key={t.key} {...props} href={`${MAIN}${t.href}`}>
              {body}
            </a>
          ) : (
            <button key={t.key} type="button" {...props}>
              {body}
            </button>
          )
        })}
        {NOTES.map((n, j) => (
          <div
            key={n.key}
            className="callout callout-note"
            data-set="note"
            ref={(el) => {
              labels.current[NAV.length + j] = el
            }}
          >
            <span className="callout-body" style={{ '--i': j } as CSSProperties}>
              <span className="callout-part">
                <i style={{ background: theme.colors[n.part] }} aria-hidden="true" />
                {n.label}
              </span>
              <span className="callout-mat">{theme.names[n.part]}</span>
            </span>
          </div>
        ))}
      </div>

      <aside ref={board} className="board" data-on={focus || undefined} inert={!focus} aria-label="Kitchen design board">
        <button type="button" className="board-back" onClick={leaveFocus}>
          <span aria-hidden="true">←</span> Back to the room
        </button>
        <p className="board-kicker">Kitchen 01 · design board</p>
        <h2 className="board-title">Pick a finish</h2>
        <p className="board-note">{theme.note}</p>
        <div className="board-themes" role="radiogroup" aria-label="Kitchen finish" onKeyDown={onThemeKey}>
          {KITCHEN_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === theme.id}
              tabIndex={t.id === theme.id ? 0 : -1}
              className="board-theme"
              onClick={() => setThemeId(t.id)}
            >
              <ThemeChips theme={t} />
              <span className="board-theme-name">{t.name}</span>
            </button>
          ))}
        </div>
        <ul className="board-materials">
          {NOTES.map((n) => (
            <li key={n.key}>
              <i style={{ background: theme.colors[n.part] }} aria-hidden="true" />
              <span className="board-part">{n.label}</span>
              <span className="board-mat">{theme.names[n.part]}</span>
            </li>
          ))}
        </ul>
        <div className="board-cta">
          <a className="board-primary" href={`${MAIN}/en/contact`}>
            Build this kitchen <span aria-hidden="true">↗</span>
          </a>
          <a className="board-secondary" href={`${MAIN}/en/gallery`}>
            See real kitchens
          </a>
        </div>
      </aside>

      <div className="room-grain" aria-hidden="true" />

      <div className="room-ui">
        <p className="room-mark">
          KENCHO <span>GROUP</span>
        </p>
        <button type="button" className="room-replay" onClick={onReplay}>
          Replay intro
        </button>
        <p className="room-hint">
          {focus ? (touch ? 'Tap a finish to try it' : 'Esc to step back') : touch ? 'Drag to look · tap the kitchen' : 'Click the kitchen to design it'}
        </p>
        <nav className="room-nav" aria-label="Kencho Group">
          <a href={`${MAIN}/en/gallery`}>Gallery</a>
          <a href={`${MAIN}/en/about`}>About us</a>
          <a href={`${MAIN}/en/contact`}>Contacts</a>
        </nav>
      </div>
    </section>
  )
}
