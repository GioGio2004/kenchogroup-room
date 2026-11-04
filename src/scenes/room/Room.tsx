import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'
import { PHOTOS } from '@/lib/scene-assets'
import {
  buildRoom,
  FILL_KEYS,
  inkLines,
  KITCHEN_PARTS,
  KITCHEN_THEMES,
  PAPER,
  ROOM,
  ROOM_COLORS,
  type FillKey,
  type Layer,
  type NotePart,
  type SketchModel,
  type Zone,
} from '@/scenes/room/sketch'
import '@/styles/room.css'

const MAIN = import.meta.env.VITE_MAIN_SITE_URL ?? 'https://kenchogroup.ge'
const DRAW_SECONDS = 4.4
const FINISH_KEY = 'kencho-room-finish'
const REDIRECT_MS = 3600
const ZONES: Zone[] = ['kitchen', 'door', 'media', 'gallery']
const NOTE_PARTS: NotePart[] = ['cabinets', 'fronts', 'worktop', 'tile']
const Z0 = -ROOM.d / 2

const PAPER_C = new THREE.Color(PAPER)
const WHITE = new THREE.Color('#ffffff')
const TV_ON = new THREE.Color('#6d7f72')
/* Face shading fades in with the washes, so the bare paper stage stays flat white. */
const SHADE = { value: 0 }

/* Phones stand inside the room and swipe between four stops, left to right. */
const EYE = new THREE.Vector3(0.3, 1.45, 2.6)
const yawTo = (x: number, z: number) => Math.atan2(x - EYE.x, -(z - EYE.z))
const STOPS: Array<{ zone: Zone; nav: number; yaw: number }> = [
  { zone: 'gallery', nav: 1, yaw: yawTo(-4.5, -1.45) },
  { zone: 'kitchen', nav: 0, yaw: yawTo(-2.0, -3.5) },
  { zone: 'door', nav: 2, yaw: yawTo(0.875, -3.5) },
  { zone: 'media', nav: 3, yaw: yawTo(2.95, -3.5) },
]
const isMobile = () => typeof window !== 'undefined' && (window.innerWidth / window.innerHeight < 0.85 || window.innerWidth < 640)

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

type V3 = [number, number, number]
type View = 'room' | 'kitchen' | 'gallery' | 'door'
type Look = { x: number; y: number }
type Mats = Record<FillKey, THREE.MeshBasicMaterial>
type Colors = Record<FillKey, THREE.Color>

/* Everything the render loop reads, tweened by GSAP from the outside. */
interface Live {
  drawn: number
  wash: number
  arrive: number
  /** 0 = the room, 1 = the close-up named by `view` */
  t: number
  view: View
  /** the walk from the doorway into the workshop */
  walk: number
  door: number
  look: Look
  /** phones: standing inside the room, the heading between stops */
  mobile: boolean
  yaw: number
  hot: Record<Zone, number>
  part: Record<NotePart, number>
  photo: Record<number, number>
}

interface NavItem {
  key: string
  anchor: string
  /** where the label sits, as a fraction of the viewport away from its dot */
  off: [number, number]
  n: string
  meta: string
  cta: string
  zone: Zone
  href?: string
}

const NAV: NavItem[] = [
  { key: 'kitchen', anchor: 'kitchen', off: [-0.01, -0.14], n: '01', meta: 'The kitchen', cta: 'Design your kitchen', zone: 'kitchen' },
  { key: 'gallery', anchor: 'gallery', off: [0.04, 0.33], n: '02', meta: 'The gallery wall', cta: 'See our kitchens', zone: 'gallery' },
  { key: 'about', anchor: 'about', off: [0.03, -0.2], n: '03', meta: 'The workshop', cta: 'About us', zone: 'door' },
  { key: 'contact', anchor: 'contact', off: [-0.01, 0.27], n: '04', meta: 'Your wall, your idea', cta: 'Contacts', zone: 'media', href: '/en/contact' },
]

const NOTES: Array<{ key: string; anchor: string; off: [number, number]; part: NotePart; label: string }> = [
  { key: 'cabinets', anchor: 'cabinets', off: [-0.02, -0.12], part: 'cabinets', label: 'Wall & tall units' },
  { key: 'tile', anchor: 'tile', off: [0.04, -0.16], part: 'tile', label: 'Splashback' },
  { key: 'worktop', anchor: 'worktop', off: [0.05, 0.1], part: 'worktop', label: 'Worktops' },
  { key: 'fronts', anchor: 'fronts', off: [-0.04, 0.12], part: 'fronts', label: 'Island & base run' },
]

const PHOTO_NAMES = ['Walnut & white island', 'Forest green', 'Warm white', 'Greige & oak']

function storedFinish() {
  try {
    return localStorage.getItem(FINISH_KEY) ?? KITCHEN_THEMES[0].id
  } catch {
    return KITCHEN_THEMES[0].id
  }
}

const Arrow = ({ out = true }: { out?: boolean }) => (
  <svg className="room-arrow" width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d={out ? 'M5 15 15 5M5 5h10v10' : 'M3 10h14M12 5l5 5-5 5'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

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

/* Invisible volumes the pointer can hover and click. */
function HitBoxes<T extends string>({
  boxes,
  enabled,
  onHot,
  onPick,
}: {
  boxes: Array<{ id: T; min: V3; max: V3 }>
  enabled: boolean
  onHot: (id: T, on: boolean) => void
  onPick: (id: T) => void
}) {
  return (
    <>
      {boxes.map(({ id, min, max }, i) => (
        <mesh
          key={`${id}-${i}`}
          position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}
          onPointerOver={(e) => {
            if (!enabled) return
            e.stopPropagation()
            onHot(id, true)
          }}
          onPointerOut={() => onHot(id, false)}
          onClick={(e) => {
            // a drag to look around is not a click
            if (!enabled || e.delta > 6) return
            e.stopPropagation()
            onPick(id)
          }}
        >
          <boxGeometry args={[max[0] - min[0], max[1] - min[1], max[2] - min[2]]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ))}
    </>
  )
}

/* Our kitchens, as real photographs, hung in the drawn frames. */
function Photos({ model, live, enabled, onHot, onPick }: { model: SketchModel; live: MutableRefObject<Live>; enabled: boolean; onHot: (i: number, on: boolean) => void; onPick: (i: number) => void }) {
  const srcs = useMemo(() => model.photos.map((p) => PHOTOS[p.key].src), [model])
  const textures = useLoader(THREE.TextureLoader, srcs)
  const mats = useMemo(
    () =>
      textures.map((t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, toneMapped: false })
      }),
    [textures],
  )
  const meshes = useRef<Array<THREE.Mesh | null>>([])
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  useFrame(() => {
    const L = live.current
    model.photos.forEach((p, i) => {
      mats[i].opacity = L.wash
      const mesh = meshes.current[i]
      if (!mesh) return
      const k = L.photo[i] ?? 0
      mesh.position.x = p.x + 0.002 + k * 0.04 + L.hot.gallery * 0.02
      mesh.scale.setScalar(1 + k * 0.025)
    })
  })

  return (
    <>
      {model.photos.map((p, i) => (
        <mesh
          key={p.key}
          ref={(m) => {
            meshes.current[i] = m
          }}
          position={[p.x + 0.002, (p.y0 + p.y1) / 2, (p.z0 + p.z1) / 2]}
          rotation={[0, Math.PI / 2, 0]}
          material={mats[i]}
          onPointerOver={(e) => {
            if (!enabled) return
            e.stopPropagation()
            onHot(i, true)
          }}
          onPointerOut={() => onHot(i, false)}
          onClick={(e) => {
            if (!enabled || e.delta > 6) return
            e.stopPropagation()
            onPick(i)
          }}
        >
          <planeGeometry args={[p.z1 - p.z0, p.y1 - p.y0]} />
        </mesh>
      ))}
    </>
  )
}

/*
 * The camera. Desktop: it looks into the room from its open front, leans a
 * little after the pointer and flies to a close-up (the kitchen, the gallery
 * wall, through the workshop door) as `t` goes to 1. Phones: it stands inside
 * the room, full screen, and turns between stops as the visitor swipes.
 */
function Rig({ live }: { live: MutableRefObject<Live> }) {
  const cur = useRef(new THREE.Vector3(-0.1, 1.1, -1.6))
  const v = useMemo(
    () => ({
      roomPos: new THREE.Vector3(),
      roomLook: new THREE.Vector3(),
      viewPos: new THREE.Vector3(),
      viewLook: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
    }),
    [],
  )
  useFrame(({ camera, size }, dt) => {
    const L = live.current
    const k = 1 - Math.pow(0.03, Math.min(dt, 0.1))
    const aspect = size.width / size.height
    const phone = L.mobile
    const cam = camera as THREE.PerspectiveCamera
    const roomFov = phone ? 58 : THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(0.72 / aspect)), 40, 56)
    const viewFov = L.view === 'gallery' && !phone ? 56 : roomFov
    const fov = THREE.MathUtils.lerp(roomFov, viewFov, L.t)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const { x, y } = L.look
    const a = 1 - L.arrive
    if (phone) {
      v.roomPos.set(EYE.x, EYE.y + a * 0.5, EYE.z + a * 2.2)
      v.roomLook.set(EYE.x + Math.sin(L.yaw) * 6, EYE.y - 0.2, EYE.z - Math.cos(L.yaw) * 6)
    } else {
      // the mouse only nudges, so the drawing stays still
      const back = Math.max(0, (1.35 - aspect) * 4)
      v.roomPos.set(0.3 + x * 0.35, 1.6 + y * 0.12 + a * 0.8, 6 + back + a * 2.6)
      v.roomLook.set(-0.1 + x * 0.18, 1.16 + y * 0.08, -1.6)
    }

    if (L.view === 'kitchen') {
      if (phone) {
        v.viewPos.set(-1.95 + x * 0.8, 1.8, 1.5)
        v.viewLook.set(-1.95 + x * 0.5, 1.05, -3.4)
      } else {
        v.viewPos.set(-1.95 + x * 0.15, 1.85 + y * 0.05, 2 + Math.max(0, (1.35 - aspect) * 2))
        v.viewLook.set(-1.95 + x * 0.08, 1.15, -3.3)
      }
    } else if (L.view === 'gallery') {
      const z = -1.45 - x * (phone ? 0.6 : 0.1)
      v.viewPos.set(-2.4, 1.62 + y * 0.04, z)
      v.viewLook.set(-4.5, 1.6, z)
    } else if (L.view === 'door') {
      // up to the doorway, then through it into the workshop
      v.a.set(0.875, 1.6, Z0 + (phone ? 3.2 : 2.6))
      v.b.set(0.875, 1.55, Z0 - 0.45)
      v.viewPos.lerpVectors(v.a, v.b, L.walk)
      v.a.set(0.875, 1.25, Z0)
      v.b.set(0.9, 1.0, Z0 - 3.2)
      v.viewLook.lerpVectors(v.a, v.b, L.walk)
    } else {
      v.viewPos.copy(v.roomPos)
      v.viewLook.copy(v.roomLook)
    }
    v.pos.lerpVectors(v.roomPos, v.viewPos, L.t)
    v.look.lerpVectors(v.roomLook, v.viewLook, L.t)
    // the walk and the phone turns are already eased: follow them closely
    const close = (L.view === 'door' && L.t > 0.98) || (phone && L.view === 'room')
    const kk = close ? 1 - Math.pow(0.0005, Math.min(dt, 0.1)) : k
    camera.position.lerp(v.pos, kk)
    cur.current.lerp(v.look, kk)
    camera.lookAt(cur.current)
  })
  return null
}

interface Item {
  key: string
  set: 'room' | 'note' | 'photo'
  anchor: string
  off: [number, number]
}

const ITEMS: Item[] = [
  ...NAV.map((t) => ({ key: t.key, set: 'room' as const, anchor: t.anchor, off: t.off })),
  ...NOTES.map((t) => ({ key: t.key, set: 'note' as const, anchor: t.anchor, off: t.off })),
  ...PHOTO_NAMES.map((_, i) => ({ key: `photo${i}`, set: 'photo' as const, anchor: `photo${i}`, off: [0, 0.012] as [number, number] })),
]

/*
 * Keeps the callouts glued to the room: each frame, a dot on its 3D anchor,
 * the label offset into clear space (kept on screen, clear of the header and
 * the bottom bar), and a leader line from the dot to the label's nearest edge.
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
    const L = live.current
    const maxY = L.t > 0.5 ? H - (L.mobile ? 190 : 120) : H - 76
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
      lx = Math.max(16, Math.min(lx, W - 16 - w))
      ly = Math.max(84, Math.min(ly, maxY - h))
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
    for (const part of KITCHEN_PARTS) {
      const lift = L.hot.kitchen * 0.14 + (part === 'shelf' ? 0 : L.part[part] * 0.22)
      mats[part].color.lerp(WHITE, lift)
    }
    mats.tv.color.lerp(TV_ON, L.hot.media * L.wash)
    // the ceiling only exists for the camera standing inside the room
    mats.ceiling.visible = L.mobile
    if (door.current) door.current.rotation.y = -Math.max(L.hot.door * 0.6, L.door * 1.6)
  })
  return null
}

/*
 * The landing room: a hand-drawn retro living room with the kitchen, drawn
 * in three.js like a designer's board, with plain text for its interface.
 * Click the kitchen to change its finish, the gallery wall to see our work,
 * the workshop door to walk through to About us.
 */
export default function Room({ onReplay }: { onReplay: () => void }) {
  const root = useRef<HTMLElement>(null)
  const door = useRef<THREE.Group>(null)
  const flight = useRef<gsap.core.Timeline | null>(null)
  const stopRef = useRef(1)
  const model = useMemo(() => buildRoom(), [])
  const reduced = useMemo(() => prefersReducedMotion(), [])
  const live = useRef<Live>({
    drawn: 0,
    wash: 0,
    arrive: 0,
    t: 0,
    view: 'room',
    walk: 0,
    door: 0,
    look: { x: 0, y: 0 },
    mobile: isMobile(),
    yaw: STOPS[1].yaw,
    hot: { kitchen: 0, door: 0, media: 0, gallery: 0 },
    part: { cabinets: 0, fronts: 0, worktop: 0, tile: 0 },
    photo: { 0: 0, 1: 0, 2: 0, 3: 0 },
  })
  const dots = useRef<Array<HTMLElement | null>>([])
  const labels = useRef<Array<HTMLElement | null>>([])
  const lines = useRef<Array<SVGLineElement | null>>([])
  const [ready, setReady] = useState(false)
  const [mobile, setMobile] = useState(isMobile)
  const [stop, setStop] = useState(1)
  const [view, setView] = useState<View>('room')
  const [hot, setHot] = useState<Zone | null>(null)
  const [part, setPart] = useState<NotePart | null>(null)
  const [photo, setPhoto] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const [arrived, setArrived] = useState(false)
  const [themeId, setThemeId] = useState(storedFinish)
  const [preview, setPreview] = useState<string | null>(null)
  const theme = KITCHEN_THEMES.find((t) => t.id === themeId) ?? KITCHEN_THEMES[0]
  const shown = KITCHEN_THEMES.find((t) => t.id === preview) ?? theme
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const mode = !ready ? 'off' : view
  const here = NAV[STOPS[stop].nav]

  const [mats] = useState<Mats>(() => {
    const m = {} as Mats
    for (const key of FILL_KEYS) m[key] = washMaterial()
    return m
  })
  const [targets] = useState<Colors>(() => {
    const c = {} as Colors
    for (const [key, hex] of Object.entries(ROOM_COLORS) as Array<[FillKey, string]>) c[key] = new THREE.Color(hex)
    for (const p of KITCHEN_PARTS) c[p] = new THREE.Color(theme.colors[p])
    return c
  })
  const partBoxes = useMemo(() => model.parts.map((p) => ({ id: p.part, min: p.min, max: p.max })), [model])
  const zoneBoxes = useMemo(() => ZONES.map((z) => ({ id: z, ...model.zones[z] })), [model])

  useEffect(
    () => () => {
      flight.current?.kill()
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
        .from('.room-chrome', { opacity: 0, y: -10, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, DRAW_SECONDS - 0.4)
    },
    { scope: root },
  )

  // Phone or desktop: decided by the screen's shape, and kept up to date.
  useEffect(() => {
    const on = () => {
      const m = isMobile()
      live.current.mobile = m
      setMobile(m)
    }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // A new finish: each part of the kitchen re-washes in turn.
  useEffect(() => {
    KITCHEN_PARTS.forEach((p, i) => {
      const c = new THREE.Color(theme.colors[p])
      gsap.to(targets[p], { r: c.r, g: c.g, b: c.b, duration: reduced ? 0 : 0.9, delay: reduced ? 0 : i * 0.07, ease: 'power2.inOut', overwrite: true })
    })
    try {
      localStorage.setItem(FINISH_KEY, theme.id)
    } catch {
      // private mode: the finish just isn't remembered
    }
  }, [theme, targets, reduced])

  // Hover: the zone lifts, its callout answers, the door eases ajar, the TV wakes.
  useEffect(() => {
    const L = live.current
    for (const z of ZONES) gsap.to(L.hot, { [z]: hot === z ? 1 : 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
  }, [hot])
  useEffect(() => {
    const L = live.current
    for (const p of NOTE_PARTS) gsap.to(L.part, { [p]: part === p ? 1 : 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  }, [part])
  useEffect(() => {
    const L = live.current
    for (let i = 0; i < PHOTO_NAMES.length; i++) gsap.to(L.photo, { [i]: photo === i ? 1 : 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
  }, [photo])
  useEffect(() => {
    if (root.current) root.current.style.cursor = hot || photo !== null ? 'pointer' : ''
  }, [hot, photo])

  // After the walk through the door: a moment in the workshop, then About us.
  useEffect(() => {
    if (!arrived) return
    const id = window.setTimeout(() => go('/en/about'), REDIRECT_MS)
    return () => window.clearTimeout(id)
  }, [arrived])

  /* Phones: turn to a stop. */
  const toStop = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(STOPS.length - 1, i))
      stopRef.current = n
      setStop(n)
      gsap.to(live.current, { yaw: STOPS[n].yaw, duration: reduced ? 0.01 : 0.8, ease: 'power3.out', overwrite: 'auto' })
    },
    [reduced],
  )

  // Desktop: the room leans a touch after the mouse. Touch: on phones a
  // swipe turns between the stops; in a close-up, a drag looks around.
  useEffect(() => {
    let dragging = false
    let last = { x: 0, y: 0 }
    let swept = 0
    const L = live.current
    const clamp = (n: number) => Math.max(-1, Math.min(1, n))
    const turning = () => L.mobile && L.view === 'room' && L.t < 0.01
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !L.mobile) {
        L.look = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) }
        return
      }
      if (!dragging) return
      const dx = (e.clientX - last.x) / window.innerWidth
      const dy = (e.clientY - last.y) / window.innerHeight
      last = { x: e.clientX, y: e.clientY }
      if (turning()) {
        swept += dx
        gsap.killTweensOf(L, 'yaw')
        L.yaw = THREE.MathUtils.clamp(L.yaw - dx * 1.4, STOPS[0].yaw - 0.2, STOPS[STOPS.length - 1].yaw + 0.2)
        return
      }
      L.look = { x: clamp(L.look.x - dx * 2.4), y: clamp(L.look.y + dy * 2) }
    }
    const down = (e: PointerEvent) => {
      dragging = e.target instanceof HTMLCanvasElement
      swept = 0
      last = { x: e.clientX, y: e.clientY }
    }
    const up = () => {
      if (dragging && turning() && Math.abs(swept) > 0.01) {
        // a flick moves one stop; a slow drag settles on the nearest
        const nearest = STOPS.reduce((best, s, i) => (Math.abs(s.yaw - L.yaw) < Math.abs(STOPS[best].yaw - L.yaw) ? i : best), 0)
        toStop(Math.abs(swept) > 0.06 ? stopRef.current + (swept < 0 ? 1 : -1) : nearest)
      }
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
  }, [toStop])

  const go = (href: string) => window.location.assign(`${MAIN}${href}`)

  /* Fly between the room and a close-up (leaving the current one first). */
  const fly = (next: View) => {
    const L = live.current
    flight.current?.kill()
    setHot(null)
    setPart(null)
    setPhoto(null)
    setMenu(false)
    setArrived(false)
    setPreview(null)
    // phones push in quicker and snappier; desktop takes the long glide
    const d = reduced ? 0.3 : L.mobile ? 1.1 : 1.5
    const ease = L.mobile ? 'power4.inOut' : 'power3.inOut'
    const tl = gsap.timeline()
    flight.current = tl
    if (L.view !== 'room' && L.view !== next) {
      if (L.view === 'door') tl.to(L, { walk: 0, duration: d * 0.9, ease: 'power2.inOut' }).to(L, { door: 0, duration: d * 0.4, ease: 'power2.inOut' }, '-=0.4')
      tl.to(L, { t: 0, duration: next === 'room' ? d : d * 0.7, ease })
    }
    if (next === 'room') {
      tl.call(() => {
        L.view = 'room'
      })
    } else {
      tl.call(() => {
        L.view = next
      })
      tl.to(L, { t: 1, duration: d, ease })
      if (next === 'door') {
        tl.to(L, { door: 1, duration: reduced ? 0.2 : 0.9, ease: 'power2.inOut' }, '-=0.3')
          .to(L, { walk: 1, duration: reduced ? 0.3 : L.mobile ? 1.7 : 2.1, ease: 'power2.inOut' }, '-=0.35')
          .call(() => setArrived(true), [], reduced ? undefined : '-=0.5')
      }
    }
    setView(next)
  }

  const pick = (z: Zone) => {
    if (z === 'kitchen') return fly('kitchen')
    if (z === 'gallery') return fly('gallery')
    if (z === 'door') return fly('door')
    setHot('media')
    gsap.delayedCall(reduced ? 0 : 0.45, () => go('/en/contact'))
  }

  const onHot = (z: Zone, on: boolean) => setHot((h) => (on ? z : h === z ? null : h))
  const onPart = (p: NotePart, on: boolean) => setPart((h) => (on ? p : h === p ? null : h))
  // touch has no hover: a tap shows (or hides) that part's material
  const tapPart = (p: NotePart) => touch && setPart((h) => (h === p ? null : p))
  const onPhoto = (i: number, on: boolean) => setPhoto((h) => (on ? i : h === i ? null : h))

  // Escape steps back out: the menu, then any close-up.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menu) setMenu(false)
      else if (view !== 'room') fly('room')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Plain clicks on Contacts wake the TV first; modified clicks stay links.
  const onNavClick = (t: NavItem) => (e: MouseEvent) => {
    if (t.href && (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) return
    e.preventDefault()
    pick(t.zone)
  }

  const onFinishKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const n = KITCHEN_THEMES.length
    const i = (KITCHEN_THEMES.findIndex((t) => t.id === theme.id) + step + n) % n
    setThemeId(KITCHEN_THEMES[i].id)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus()
  }

  const hint =
    view === 'kitchen'
      ? touch
        ? 'Tap a part to see its material'
        : 'Hover the kitchen to see each material · Esc to step back'
      : view === 'gallery'
        ? touch
          ? 'Drag to move along the wall'
          : 'Hover a kitchen · Esc to step back'
        : 'Click the kitchen to design it'

  return (
    <section ref={root} className="room" data-view={view} data-mobile={mobile || undefined} aria-label="The room">
      <Canvas
        className="room-canvas"
        dpr={[1, 2]}
        camera={{ position: [0.3, 2.4, 9], fov: 44, near: 0.1, far: 60 }}
        flat
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => setPart(null)}
      >
        <InkLayer layer={model.main} mats={mats} live={live} />
        <group ref={door} position={model.hinge}>
          <InkLayer layer={model.door} mats={mats} live={live} from={0.5} to={0.75} />
        </group>
        <Suspense fallback={null}>
          <Photos model={model} live={live} enabled={view === 'gallery'} onHot={onPhoto} onPick={() => go('/en/gallery')} />
        </Suspense>
        <Paint mats={mats} targets={targets} live={live} door={door} />
        <HitBoxes boxes={zoneBoxes} enabled={ready && view === 'room' && !menu} onHot={onHot} onPick={pick} />
        <HitBoxes boxes={partBoxes} enabled={view === 'kitchen'} onHot={onPart} onPick={tapPart} />
        <Rig live={live} />
        <Projector model={model} live={live} dots={dots} labels={labels} lines={lines} />
      </Canvas>

      <div className="room-callouts" data-mode={mode}>
        <svg className="room-leaders" aria-hidden="true">
          {ITEMS.map((it, i) => (
            <line
              key={it.key}
              data-set={it.set}
              data-hot={(it.set === 'room' && NAV[i].zone === hot) || (it.set === 'note' && NOTES[i - NAV.length].part === part) || undefined}
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
            data-hot={(it.set === 'room' && NAV[i].zone === hot) || (it.set === 'note' && NOTES[i - NAV.length].part === part) || undefined}
            ref={(el) => {
              dots.current[i] = el
            }}
            aria-hidden="true"
          />
        ))}
        {NAV.map((t, i) => {
          const body = (
            <>
              <span className="callout-meta">
                {t.n} · {t.meta}
              </span>
              <span className="callout-cta">
                {t.cta} <Arrow out={!!t.href} />
              </span>
            </>
          )
          const props = {
            className: 'callout',
            'data-set': 'room',
            'data-hot': t.zone === hot || undefined,
            tabIndex: mode === 'room' && !mobile ? 0 : -1,
            ref: (el: HTMLElement | null) => {
              labels.current[i] = el
            },
            onClick: onNavClick(t),
            onPointerEnter: () => setHot(t.zone),
            onPointerLeave: () => onHot(t.zone, false),
            onFocus: () => setHot(t.zone),
            onBlur: () => onHot(t.zone, false),
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
            data-hot={n.part === part || undefined}
            ref={(el) => {
              labels.current[NAV.length + j] = el
            }}
          >
            <span className="note-part">
              <i style={{ background: theme.colors[n.part] }} aria-hidden="true" />
              {n.label}
            </span>
            <span className="note-mat">{theme.names[n.part]}</span>
          </div>
        ))}
        {PHOTO_NAMES.map((name, j) => (
          <a
            key={name}
            className="callout callout-photo"
            data-set="photo"
            data-hot={photo === j || undefined}
            href={`${MAIN}/en/gallery`}
            tabIndex={view === 'gallery' ? 0 : -1}
            ref={(el) => {
              labels.current[NAV.length + NOTES.length + j] = el
            }}
          >
            <span className="photo-n">Kitchen {String(j + 1).padStart(2, '0')}</span>
            <span className="photo-name">
              {name} <Arrow />
            </span>
          </a>
        ))}
      </div>

      {/* Phones: where you are standing, and where a swipe goes next. */}
      <div className="room-stops" data-on={(mobile && view === 'room' && ready) || undefined} inert={!(mobile && view === 'room' && ready)}>
        <div className="stops-text" key={stop}>
          <p className="stops-meta">
            {here.n} / 04 · {here.meta}
          </p>
          <button type="button" className="stops-cta" onClick={() => pick(STOPS[stop].zone)}>
            {here.cta} <Arrow out={!!here.href} />
          </button>
        </div>
        <div className="stops-nav">
          <button type="button" className="stops-step" aria-label="Turn left" disabled={stop === 0} onClick={() => toStop(stop - 1)}>
            ←
          </button>
          <span className="stops-dots" aria-hidden="true">
            {STOPS.map((s, i) => (
              <i key={s.zone} data-on={i === stop || undefined} />
            ))}
          </span>
          <button type="button" className="stops-step" aria-label="Turn right" disabled={stop === STOPS.length - 1} onClick={() => toStop(stop + 1)}>
            →
          </button>
        </div>
        <p className="stops-hint">Swipe to look around the room</p>
      </div>

      {/* The kitchen close-up: a transparent finish bar along the bottom. */}
      <div className="room-bar" data-on={view === 'kitchen' || undefined} inert={view !== 'kitchen'}>
        <button type="button" className="room-link" onClick={() => fly('room')}>
          ← Room
        </button>
        <div className="finish">
          <p className="finish-name" aria-live="polite">
            <b>{shown.name}</b>
            <span>{shown.note}</span>
          </p>
          <div className="finish-swatches" role="radiogroup" aria-label="Kitchen finish" onKeyDown={onFinishKey}>
            {KITCHEN_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === theme.id}
                aria-label={t.name}
                tabIndex={t.id === theme.id ? 0 : -1}
                className="finish-swatch"
                style={{ '--a': t.colors.cabinets, '--b': t.colors.fronts, '--c': t.colors.worktop } as CSSProperties}
                onPointerEnter={() => setPreview(t.id)}
                onPointerLeave={() => setPreview(null)}
                onFocus={() => setPreview(t.id)}
                onBlur={() => setPreview(null)}
                onClick={() => setThemeId(t.id)}
              />
            ))}
          </div>
        </div>
        <a className="room-link" href={`${MAIN}/en/contact`}>
          Build this kitchen <Arrow />
        </a>
      </div>

      {/* The gallery wall close-up. */}
      <div className="room-bar" data-on={view === 'gallery' || undefined} inert={view !== 'gallery'}>
        <button type="button" className="room-link" onClick={() => fly('room')}>
          ← Room
        </button>
        <p className="finish-name">
          <b>The gallery wall</b>
          <span>Four kitchens from our workshop in Tbilisi.</span>
        </p>
        <a className="room-link" href={`${MAIN}/en/gallery`}>
          Full gallery <Arrow />
        </a>
      </div>

      {/* Through the workshop door: a beat inside, then the official page. */}
      <div className="room-passage" data-on={arrived || undefined} inert={!arrived} role="status" aria-live="polite">
        <p className="passage-kicker">03 · The workshop</p>
        <p className="passage-title">This is where every Kencho piece is made.</p>
        <p className="passage-text">Taking you to the official Kencho Group page…</p>
        <span className="passage-bar" aria-hidden="true">
          <i style={{ animationDuration: `${REDIRECT_MS}ms` }} />
        </span>
        <div className="passage-actions">
          <a className="room-link" href={`${MAIN}/en/about`}>
            Go now <Arrow />
          </a>
          <button type="button" className="room-link" onClick={() => fly('room')}>
            Stay in the room
          </button>
        </div>
      </div>

      <div className="room-grain" aria-hidden="true" />

      <header className="room-header">
        <a className="room-wordmark room-chrome" href={MAIN} aria-label="Kencho Group">
          <span>KENCHO</span>
          <span className="room-wordmark-sub">GROUP</span>
        </a>
        <div className="room-actions room-chrome">
          <a className="room-link room-link-gallery" href={`${MAIN}/en/gallery`}>
            Gallery <Arrow />
          </a>
          <button type="button" className="room-link" aria-expanded={menu} aria-controls="room-menu" onClick={() => setMenu((m) => !m)}>
            {menu ? 'Close' : 'Menu'}
          </button>
          <nav id="room-menu" className="room-menu" data-on={menu || undefined} inert={!menu} aria-label="Kencho Group">
            <button type="button" onClick={() => fly('kitchen')}>
              <span>01</span>Design your kitchen
            </button>
            <button type="button" onClick={() => fly('gallery')}>
              <span>02</span>The gallery wall
            </button>
            <button type="button" onClick={() => fly('door')}>
              <span>03</span>The workshop
            </button>
            <a href={`${MAIN}/en/contact`}>
              <span>04</span>Contacts <Arrow />
            </a>
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                onReplay()
              }}
            >
              <span>—</span>Replay intro
            </button>
            <a href={MAIN}>
              <span>—</span>kenchogroup.ge <Arrow />
            </a>
          </nav>
        </div>
      </header>

      <p className="room-hint room-chrome" data-hidden={view === 'door' || (mobile && view === 'room') || undefined}>
        <span aria-hidden="true" />
        {hint}
      </p>
    </section>
  )
}
