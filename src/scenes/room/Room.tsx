import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/motion'
import { narrator } from '@/lib/narrator'
import { tracker } from '@/lib/tracker'
import { PHOTOS } from '@/lib/scene-assets'
import {
  buildRoom,
  FILL_KEYS,
  inkLines,
  KITCHEN_PARTS,
  KITCHEN_THEMES,
  MONO_THEME,
  PAPER,
  ROOM,
  ROOM_COLORS,
  type FillKey,
  type Layer,
  type NotePart,
  type SketchModel,
  type Zone,
} from '@/scenes/room/sketch'
import { makeRealMaterials, REAL_COLORS } from '@/scenes/room/real-materials'
import { RealScene } from '@/scenes/room/RealScene'
import '@/styles/room.css'

const MAIN = import.meta.env.VITE_MAIN_SITE_URL ?? 'https://www.kenchogroup.ge'
/* The page's finish deck tells the room about a new pick with this event. */
const FINISH_EVENT = 'kencho:finish'
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
const daypart = () => {
  const h = new Date().getHours()
  return h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night'
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/*
 * The kitchen close-up's camera angles: where the camera stands and what it
 * looks at, on desktop and on phones (narrower, so a little further back).
 */
type Pose = { pos: V3; look: V3 }
/* (`short`: the phone sheet's label, one word so all five fit on one row) */
const ANGLES: Array<{ id: string; label: string; short: string; desk: Pose; phone: Pose }> = [
  { id: 'front', label: 'Front', short: 'Front', desk: { pos: [-1.95, 1.85, 2], look: [-1.95, 1.15, -3.3] }, phone: { pos: [-1.95, 1.8, 1.5], look: [-1.95, 1.05, -3.4] } },
  { id: 'left', label: 'Left side', short: 'Left', desk: { pos: [-3.4, 1.62, 1.2], look: [-1.4, 1.0, -2.6] }, phone: { pos: [-3.4, 1.62, 1.8], look: [-1.5, 1.0, -2.6] } },
  { id: 'right', label: 'Right side', short: 'Right', desk: { pos: [0.95, 1.6, 0.1], look: [-2.3, 1.0, -2.5] }, phone: { pos: [0.9, 1.6, 0.8], look: [-2.2, 1.0, -2.4] } },
  { id: 'above', label: 'From above', short: 'Above', desk: { pos: [-1.7, 2.75, 0.6], look: [-1.75, 0.5, -2.2] }, phone: { pos: [-1.75, 2.75, 1.2], look: [-1.75, 0.4, -2.3] } },
  { id: 'detail', label: 'Close up', short: 'Detail', desk: { pos: [-0.3, 1.35, 0.25], look: [-1.8, 0.95, -1.4] }, phone: { pos: [-0.5, 1.4, 0.6], look: [-1.9, 0.95, -1.4] } },
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
  /** the height of the paper panel along the bottom (px); the frame centres above it */
  sheet: number
  /** desktop: the width of the finishes popup on the left (px); the frame centres beside it */
  side: number
  yaw: number
  /** the kitchen close-up's camera angle (index into ANGLES) */
  angle: number
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
  // (above the TV wall, on plain wall: below it, the label landed on the rug)
  { key: 'contact', anchor: 'contact', off: [0.02, -0.17], n: '04', meta: 'Your wall, your idea', cta: 'Contacts', zone: 'media', href: '/en/contact' },
]

const NOTES: Array<{ key: string; anchor: string; off: [number, number]; part: NotePart; label: string }> = [
  { key: 'cabinets', anchor: 'cabinets', off: [-0.02, -0.12], part: 'cabinets', label: 'Wall & tall units' },
  { key: 'tile', anchor: 'tile', off: [0.04, -0.16], part: 'tile', label: 'Splashback' },
  { key: 'worktop', anchor: 'worktop', off: [0.05, 0.1], part: 'worktop', label: 'Worktops' },
  { key: 'fronts', anchor: 'fronts', off: [-0.04, 0.12], part: 'fronts', label: 'Island & base run' },
]

const PHOTO_NAMES = ['Walnut & white island', 'Forest green', 'Warm white', 'Greige & oak']

/* The menu panel: where each item goes. */
const MENU_ITEMS: Array<{ n: string; label: string; note: string; view?: View; href?: string }> = [
  { n: '01', label: 'Design your kitchen', note: 'Finishes and camera angles, changed live', view: 'kitchen' },
  { n: '02', label: 'The gallery wall', note: 'Four kitchens from our workshop', view: 'gallery' },
  { n: '03', label: 'The workshop', note: 'Walk through the door to About us', view: 'door' },
  { n: '04', label: 'Contacts', note: 'Your wall, your idea', href: '/en/contact' },
]

/* The two rooms: the hand-drawn sketch (the sketchbook path) and the realistic one. */
export type RoomLook = 'sketch' | 'real'
const THEMES = { sketch: KITCHEN_THEMES, real: [MONO_THEME, ...KITCHEN_THEMES] }

function storedFinish(look: RoomLook) {
  try {
    return localStorage.getItem(`${FINISH_KEY}-${look}`) ?? THEMES[look][0].id
  } catch {
    return THEMES[look][0].id
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
  const lift = useRef({ x: 0, y: 0 })
  const still = useMemo(() => prefersReducedMotion(), [])
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
    // The picture centres in the space the panels leave free: above the paper
    // panel along the bottom, right of the finishes popup on desktop. It
    // glides as they come and go (an off-centre lens: nothing tilts or distorts).
    const want = { x: -L.side / 2, y: L.sheet / 2 }
    const glide = still ? 1 : 1 - Math.pow(0.02, Math.min(dt, 0.1))
    lift.current.x += (want.x - lift.current.x) * glide
    lift.current.y += (want.y - lift.current.y) * glide
    const ox = Math.round(lift.current.x)
    const oy = Math.round(lift.current.y)
    const sub = cam.view
    if (ox === 0 && oy === 0) {
      if (sub?.enabled) cam.clearViewOffset()
    } else if (!sub?.enabled || sub.offsetX !== ox || sub.offsetY !== oy || sub.fullWidth !== size.width || sub.fullHeight !== size.height) {
      cam.setViewOffset(size.width, size.height, ox, oy, size.width, size.height)
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
      // the chosen angle; the camera's damping glides it from one to the next
      const pose = ANGLES[L.angle] ?? ANGLES[0]
      const { pos, look } = phone ? pose.phone : pose.desk
      // a drag (phones) or the mouse nudges the view, the front one most
      const nudge = phone ? (L.angle === 0 ? 0.6 : 0.3) : 0.15
      const back = phone || L.angle !== 0 ? 0 : Math.max(0, (1.35 - aspect) * 2)
      // never closer than 0.6 m to a side wall, whatever the nudge
      const edge = ROOM.w / 2 - 0.6
      v.viewPos.set(THREE.MathUtils.clamp(pos[0] + x * nudge, -edge, edge), pos[1] + y * 0.05, pos[2] + back)
      v.viewLook.set(look[0] + x * nudge * 0.6, look[1], look[2])
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
    // clear of the navbar and the hint under it, the paper panel along the bottom and the finishes popup
    const minY = L.mobile ? 124 : L.t > 0.5 ? 136 : 84
    const maxY = L.sheet ? H - L.sheet - 12 : L.t > 0.5 ? H - 120 : H - 76
    const minX = L.side + 16
    const hide = L.mobile || L.t > 0.5
    ITEMS.forEach((it, i) => {
      const dot = dots.current[i]
      const label = labels.current[i]
      const line = lines.current[i]
      if (!dot || !label || !line) return
      v.copy(model.anchors[it.anchor]).project(camera)
      const ax = ((v.x + 1) / 2) * W
      const ay = ((1 - v.y) / 2) * H
      // (in a close-up, and on phones, anything that would land under the bottom bar stays hidden)
      const shown = v.z < 1 && ax > L.side && ax < W && ay > 0 && ay < (hide ? maxY : H) ? 'visible' : 'hidden'
      const w = label.offsetWidth
      const h = label.offsetHeight
      let lx = ax + it.off[0] * W - (it.off[0] < 0 ? w : 0)
      let ly = ay + it.off[1] * H - (it.off[1] < 0 ? h : 0)
      lx = Math.max(minX, Math.min(lx, W - 16 - w))
      ly = Math.max(minY, Math.min(ly, maxY - h))
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
/*
 * `embedded`: the room is a section of the page, not the whole screen. It
 * draws itself the first time it is `active` (on screen), sleeps while it
 * is off screen, and leaves the header and menu to the page.
 */
export default function Room({
  onReplay,
  sound = true,
  look = 'sketch',
  embedded = false,
  active = true,
  onContact,
}: {
  onReplay: () => void
  sound?: boolean
  look?: RoomLook
  embedded?: boolean
  active?: boolean
  /** given: the TV (and "Build this kitchen") open the page's contact card instead of leaving */
  onContact?: () => void
}) {
  const root = useRef<HTMLElement>(null)
  const door = useRef<THREE.Group>(null)
  const flight = useRef<gsap.core.Timeline | null>(null)
  const stopRef = useRef(1)
  const model = useMemo(() => buildRoom({ real: look === 'real' }), [look])
  const themes = THEMES[look]
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
    sheet: 0,
    side: 0,
    yaw: STOPS[1].yaw,
    angle: 0,
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
  const [angle, setAngle] = useState(0)
  const toAngle = (i: number) => {
    setAngle(i)
    setPart(null)
    live.current.angle = i
  }
  const [view, setView] = useState<View>('room')
  const [hot, setHot] = useState<Zone | null>(null)
  const [part, setPart] = useState<NotePart | null>(null)
  const [photo, setPhoto] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  // the narrator's room lines follow the intro's sound choice; the menu can mute them
  const [voice, setVoice] = useState(sound)
  const returning = tracker.returning
  // what the visitor has done so far, for the narrator to react to
  const visits = useRef({ kitchen: 0, gallery: 0, door: 0, finishes: [] as number[], stops: new Set<number>([1]) })
  const [pointed, setPointed] = useState<number | null>(null)
  const [, setForgotten] = useState(0)
  const menuButton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const panelClose = useRef<HTMLButtonElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)
  const items = useRef<Array<HTMLElement | null>>([])
  const [arrived, setArrived] = useState(false)
  // phones: the finishes popup, and whether the visitor has turned yet (the swipe hint goes once they have)
  const [finishes, setFinishes] = useState(false)
  const [turned, setTurned] = useState(false)
  const finishOpen = useRef<HTMLButtonElement>(null)
  const finishPanel = useRef<HTMLDivElement>(null)
  const sheets = useRef<Partial<Record<'room' | 'kitchen' | 'gallery', HTMLElement | null>>>({})
  const [themeId, setThemeId] = useState(() => storedFinish(look))
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const mode = !ready ? 'off' : view
  const here = NAV[STOPS[stop].nav]
  // embedded: nothing is drawn until the room first comes on screen
  const [started, setStarted] = useState(!embedded)
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
    if (active) setStarted(true)
  }, [active])

  const [realMats] = useState(() => (look === 'real' ? makeRealMaterials() : null))
  const [mats] = useState<Mats>(() => {
    const m = {} as Mats
    for (const key of FILL_KEYS) m[key] = washMaterial()
    return m
  })
  const [targets] = useState<Colors>(() => {
    const c = {} as Colors
    for (const [key, hex] of Object.entries(look === 'real' ? REAL_COLORS : ROOM_COLORS) as Array<[FillKey, string]>) c[key] = new THREE.Color(hex)
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
      if (!started) return
      if (reduced) {
        Object.assign(L, { drawn: 1, wash: 1, arrive: 1 })
        setReady(true)
        return
      }
      const tl = gsap.timeline()
      if (!embedded) tl.fromTo(root.current, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath' })
      tl.to(L, { drawn: 1, duration: DRAW_SECONDS, ease: 'power1.inOut', onComplete: () => setReady(true) }, 0.5)
        .to(L, { arrive: 1, duration: DRAW_SECONDS + 0.6, ease: 'power2.inOut' }, 0.5)
        .to(L, look === 'real' ? { wash: 1, duration: 3.4, ease: 'power2.inOut' } : { wash: 1, duration: 1.8, ease: 'power2.out' }, look === 'real' ? 0.4 : 0.5 + DRAW_SECONDS * 0.6)
        .from('.room-chrome', { opacity: 0, y: -10, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, DRAW_SECONDS - 0.4)
    },
    { scope: root, dependencies: [started] },
  )

  // Embedded: the page's switch is the narrator's switch.
  useEffect(() => {
    if (embedded) setVoice(sound)
  }, [embedded, sound])

  // The page's finish deck picked a new finish.
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (themes.some((t) => t.id === id)) setThemeId(id)
    }
    window.addEventListener(FINISH_EVENT, on)
    return () => window.removeEventListener(FINISH_EVENT, on)
  }, [themes])

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

  // The camera centres the picture in what the panels leave free: above the
  // paper panel along the bottom (the phone stops, a close-up's bar) and
  // beside the finishes popup (phones: above it; desktop: to its right).
  useEffect(() => {
    const L = live.current
    const bar =
      view === 'room' ? (mobile && ready ? sheets.current.room : null) : view === 'kitchen' || view === 'gallery' ? sheets.current[view] : null
    const pop = finishes ? finishPanel.current : null
    const measure = () => {
      // (the popup spans the bottom on phones and narrow screens, and sits bottom left on wide ones)
      const side = !!pop && pop.offsetWidth < (root.current?.offsetWidth ?? 0) - 1
      L.side = side ? pop.offsetWidth : 0
      L.sheet = pop && !side ? pop.offsetHeight : (bar?.offsetHeight ?? 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of [bar, pop]) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [mobile, view, ready, finishes])

  // A new finish: each part of the kitchen re-washes in turn.
  useEffect(() => {
    KITCHEN_PARTS.forEach((p, i) => {
      const c = new THREE.Color(theme.colors[p])
      gsap.to(targets[p], { r: c.r, g: c.g, b: c.b, duration: reduced ? 0 : 0.9, delay: reduced ? 0 : i * 0.07, ease: 'power2.inOut', overwrite: true })
    })
    try {
      localStorage.setItem(`${FINISH_KEY}-${look}`, theme.id)
    } catch {
      // private mode: the finish just isn't remembered
    }
  }, [theme, targets, reduced, look])

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

  // After the walk through the door: a moment in the workshop (and the end
  // of the narrator's line), then About us.
  useEffect(() => {
    if (!arrived) return
    const id = window.setTimeout(() => void narrator.whenQuiet(4000).then(() => go('/en/about')), REDIRECT_MS)
    return () => window.clearTimeout(id)
  }, [arrived])

  // ---- the narrator -----------------------------------------------------
  // Muted (the intro's choice, or the menu switch) means no line plays.
  useEffect(() => {
    narrator.setMuted(!voice)
    tracker.set({ voice })
  }, [voice])

  // Arriving: a welcome (or a welcome back), and the likely next lines loaded.
  useEffect(() => {
    if (!ready) return
    void narrator.prime(['kitchen-first', 'gallery-first', 'door-walk', 'contacts-click'])
    const id = window.setTimeout(() => {
      const line = returning ? (Math.random() < 0.5 ? 'arrive-return' : `arrive-${daypart()}`) : 'arrive-first'
      void narrator.say(line, { priority: 1 })
    }, 1200)
    return () => window.clearTimeout(id)
  }, [ready, returning])

  // Unprompted lines: idle nudges, time on the site, coming back to the tab.
  // They wait for 10 s of quiet and never talk over a camera move.
  useEffect(() => {
    if (!ready) return
    const L = live.current
    const began = performance.now()
    let active = began
    let hiddenAt = 0
    const poke = () => {
      active = performance.now()
    }
    const calm = () => activeRef.current && narrator.quietFor() > 10000 && !flight.current?.isActive() && L.view !== 'door'
    const tick = window.setInterval(() => {
      if (!document.hidden && activeRef.current) tracker.addTime(2000)
      if (document.hidden || !calm()) return
      const now = performance.now()
      const idle = now - active
      const stay = now - began
      if (idle > 60000 && narrator.hasSaid('idle-20s')) void narrator.say('idle-60s', { priority: 1 })
      else if (idle > 20000) void narrator.say('idle-20s', { priority: 1 })
      else if (stay > 60000) void narrator.say(stay > 300000 ? 'time-5min' : stay > 180000 ? 'time-3min' : 'time-1min', { priority: 1 })
    }, 2000)
    const seen = () => {
      if (document.hidden) {
        hiddenAt = performance.now()
        return
      }
      if (hiddenAt && performance.now() - hiddenAt > 30000) {
        window.setTimeout(() => {
          if (narrator.quietFor() > 3000) void narrator.say('tab-return', { priority: 1 })
        }, 800)
      }
      hiddenAt = 0
      poke()
    }
    const events = ['pointerdown', 'keydown', 'wheel'] as const
    events.forEach((ev) => window.addEventListener(ev, poke, { passive: true }))
    document.addEventListener('visibilitychange', seen)
    return () => {
      window.clearInterval(tick)
      events.forEach((ev) => window.removeEventListener(ev, poke))
      document.removeEventListener('visibilitychange', seen)
    }
  }, [ready])

  // Hover lines (desktop): the door eases ajar with a creak, the TV wakes,
  // the first material, the first photo. Quiet lines: they never cut in.
  useEffect(() => {
    if (touch) return
    if (hot === 'door') void narrator.say('door-hover', { priority: 2 })
    if (hot === 'media') void narrator.say('tv-hover', { priority: 2 })
  }, [hot, touch])
  useEffect(() => {
    if (part) void narrator.say('kitchen-materials', { priority: 2 })
  }, [part])
  useEffect(() => {
    if (photo !== null) void narrator.say('gallery-hover', { priority: 2 })
  }, [photo])

  // A long look at the kitchen: a gentle nudge toward building it.
  useEffect(() => {
    if (view !== 'kitchen') return
    const id = window.setTimeout(() => {
      if (narrator.quietFor() > 5000) void narrator.say('kitchen-linger', { priority: 1 })
    }, 45000)
    return () => window.clearTimeout(id)
  }, [view])

  /* Phones: turn to a stop. */
  const toStop = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(STOPS.length - 1, i))
      if (n !== stopRef.current) {
        const seen = visits.current.stops
        seen.add(n)
        setTurned(true)
        void narrator.say(seen.size === STOPS.length ? 'swipe-all' : 'swipe-first', { priority: 2 })
      }
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

  /* Leave for the main site once the narrator's line ends (at most `cap` ms). */
  const leave = (url: string, line: Promise<void> = Promise.resolve(), cap = 2800) => {
    tracker.count('links', url.replace(MAIN, '') || '/')
    void Promise.all([wait(reduced ? 0 : 450), Promise.race([line, wait(cap)])]).then(() => window.location.assign(url))
  }
  // Links out play their line first; modified clicks (new tab) stay plain links.
  const linkOut = (lineId: string) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    const url = e.currentTarget.getAttribute('href')
    if (!url) return
    e.preventDefault()
    leave(url, narrator.say(lineId, { priority: 3 }))
  }

  /* Fly between the room and a close-up (leaving the current one first). */
  const fly = (next: View) => {
    const L = live.current
    flight.current?.kill()
    setHot(null)
    setPart(null)
    setPhoto(null)
    setMenu(false)
    setPointed(null)
    setArrived(false)
    setFinishes(false)
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
          .call(() => void narrator.sfx('door-creak'), [], '<')
          .to(L, { walk: 1, duration: reduced ? 0.3 : L.mobile ? 1.7 : 2.1, ease: 'power2.inOut' }, '-=0.35')
          .call(() => setArrived(true), [], reduced ? undefined : '-=0.5')
      }
    }
    setView(next)
    if (next !== 'room') tracker.count('views', next)

    // The narrator answers: first visit, second, then once more.
    const v = visits.current
    if (next === 'kitchen') {
      toAngle(0)
      const n = ++v.kitchen
      void narrator.say(n === 1 ? 'kitchen-first' : n === 2 ? 'kitchen-second' : 'kitchen-again', { priority: 3 })
    } else if (next === 'gallery') {
      void narrator.say(++v.gallery === 1 ? 'gallery-first' : 'gallery-again', { priority: 3 })
    } else if (next === 'door') {
      void narrator.say(++v.door === 1 ? 'door-walk' : 'door-again', { priority: 3 })
    }
  }

  /* "Stay in the room": back out of the workshop. */
  const stay = () => {
    fly('room')
    void narrator.say('door-stay', { priority: 3 })
  }

  // Embedded: scrolled away from a close-up, the room steps back out of it.
  useEffect(() => {
    const v = live.current.view
    if (embedded && !active && (v === 'kitchen' || v === 'gallery')) fly('room')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, active])

  /* A new finish: the first one, the one picked, or a gentle "can't decide?". */
  const chooseFinish = (id: string) => {
    if (id === themeId) return
    setThemeId(id)
    tracker.count('finishes', id)
    tracker.set({ lastFinish: id })
    const now = performance.now()
    const recent = (visits.current.finishes = [...visits.current.finishes.filter((t) => now - t < 8000), now])
    if (!narrator.hasSaid('finish-first')) void narrator.say('finish-first', { priority: 2 })
    else if (recent.length >= 4) void narrator.say('kitchen-indecisive', { priority: 2 })
    else void narrator.say(`finish-${id}`, { priority: 2 })
  }

  const pick = (z: Zone) => {
    if (z === 'kitchen') return fly('kitchen')
    if (z === 'gallery') return fly('gallery')
    if (z === 'door') return fly('door')
    setHot('media')
    if (onContact) {
      void narrator.say('contacts-click', { priority: 3 })
      onContact()
      return
    }
    leave(`${MAIN}/en/contact`, narrator.say('contacts-click', { priority: 3 }))
  }

  const onHot = (z: Zone, on: boolean) => setHot((h) => (on ? z : h === z ? null : h))
  const onPart = (p: NotePart, on: boolean) => setPart((h) => (on ? p : h === p ? null : h))
  // touch has no hover: a tap shows (or hides) that part's material
  const tapPart = (p: NotePart) => touch && setPart((h) => (h === p ? null : p))
  const onPhoto = (i: number, on: boolean) => {
    if (on) tracker.count('photos', PHOTO_NAMES[i])
    setPhoto((h) => (on ? i : h === i ? null : h))
  }

  /* Phones: the finishes popup. Picks apply live, so the kitchen above it recolours as you go. */
  const openFinishes = () => {
    setPart(null)
    setFinishes(true)
    requestAnimationFrame(() => finishPanel.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true }))
  }
  const closeFinishes = () => {
    setFinishes(false)
    if (finishPanel.current?.contains(document.activeElement)) finishOpen.current?.focus({ preventScroll: true })
  }

  // Escape steps back out: the menu or the finishes, then any close-up.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menu) closeMenu()
      else if (finishes) closeFinishes()
      else if (view !== 'room') fly('room')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* The menu's indicator glides to the item being pointed at (or to where you are). */
  const menuAt = MENU_ITEMS.findIndex((m) => m.view === view)
  const point = (i: number | null) => {
    setPointed(i)
    const bar = indicator.current
    const el = i === null || i < 0 ? null : items.current[i]
    if (!bar) return
    if (!el) {
      gsap.to(bar, { opacity: 0, duration: 0.3, overwrite: 'auto' })
      return
    }
    gsap.to(bar, { y: el.offsetTop, scaleY: el.offsetHeight, opacity: 1, duration: reduced ? 0 : 0.55, ease: 'power3.out', overwrite: 'auto' })
  }

  // Opening the menu: focus moves in and the indicator finds where you are.
  const openMenu = () => {
    setMenu(true)
    requestAnimationFrame(() => {
      panelClose.current?.focus({ preventScroll: true })
      point(menuAt >= 0 ? menuAt : null)
    })
  }
  // Closing it: focus goes back to the Menu button.
  const closeMenu = () => {
    setMenu(false)
    setPointed(null)
    if (panel.current?.contains(document.activeElement)) menuButton.current?.focus({ preventScroll: true })
  }

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
    const n = themes.length
    const i = (themes.findIndex((t) => t.id === theme.id) + step + n) % n
    chooseFinish(themes[i].id)
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

  const swatchOf = (t: (typeof themes)[number]) => ({ '--a': t.colors.cabinets, '--b': t.colors.fronts, '--c': t.colors.worktop }) as CSSProperties

  // The camera angles: a row of tabs, a mark gliding under the chosen one
  // (one-word labels on phones and narrow screens).
  const anglesNav = (
    <nav className="room-angles" aria-label="Camera angle" style={{ '--i': angle, '--n': ANGLES.length } as CSSProperties}>
      {ANGLES.map((a, i) => (
        <button
          key={a.id}
          type="button"
          className="angles-item"
          aria-pressed={angle === i}
          aria-label={a.label}
          onClick={() => {
            toAngle(i)
            tracker.count('angles', a.id)
          }}
        >
          <span className="angles-long">{a.label}</span>
          <span className="angles-short">{a.short}</span>
        </button>
      ))}
      <i className="angles-mark" aria-hidden="true" />
    </nav>
  )

  return (
    <section ref={root} className="room" data-look={look} data-view={view} data-mobile={mobile || undefined} data-embedded={embedded || undefined} aria-label="The room">
      <Canvas
        className="room-canvas"
        frameloop={embedded && !active ? 'never' : 'always'}
        dpr={look === 'real' ? [1, 1.75] : [1, 2]}
        camera={{ position: [0.3, 2.4, 9], fov: 44, near: 0.1, far: 60 }}
        flat={look === 'sketch'}
        shadows={look === 'real' ? 'soft' : undefined}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => setPart(null)}
      >
        {realMats ? (
          <RealScene main={model.main} leaf={model.door} hinge={model.hinge} mats={realMats} targets={targets} live={live} door={door} />
        ) : (
          <>
            <InkLayer layer={model.main} mats={mats} live={live} />
            <group ref={door} position={model.hinge}>
              <InkLayer layer={model.door} mats={mats} live={live} from={0.5} to={0.75} />
            </group>
            <Paint mats={mats} targets={targets} live={live} door={door} />
          </>
        )}
        <Suspense fallback={null}>
          <Photos
            model={model}
            live={live}
            enabled={view === 'gallery'}
            onHot={onPhoto}
            onPick={() => leave(`${MAIN}/en/gallery`, narrator.say('gallery-leave', { priority: 3 }))}
          />
        </Suspense>
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
            {/* touch has no hover to end it: a tap on the part again, or here */}
            {touch && (
              <button type="button" className="note-close" aria-label={`Hide ${n.label.toLowerCase()}`} tabIndex={n.part === part ? 0 : -1} onClick={() => setPart(null)}>
                <span className="panel-x" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {PHOTO_NAMES.map((name, j) => (
          <a
            key={name}
            className="callout callout-photo"
            data-set="photo"
            data-hot={photo === j || undefined}
            href={`${MAIN}/en/gallery`}
            onClick={linkOut('gallery-leave')}
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

      {/* Phones: where you are standing, and where a swipe goes next, on a paper sheet along the bottom. */}
      <div
        ref={(el) => {
          sheets.current.room = el
        }}
        className="room-stops"
        data-on={(mobile && view === 'room' && ready) || undefined}
        inert={!(mobile && view === 'room' && ready)}
      >
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
        <p className="stops-hint" data-done={turned || undefined}>
          Swipe to look around the room
        </p>
      </div>

      {/* The kitchen close-up's camera angles: a list on the right on desktop, a row of tabs in the sheet on phones. */}
      {/* The kitchen close-up: a paper panel along the bottom with the way back, the finish, the camera angles and the next step. */}
      <div
        ref={(el) => {
          sheets.current.kitchen = el
        }}
        className="room-bar"
        data-on={view === 'kitchen' || undefined}
        inert={view !== 'kitchen'}
      >
        {anglesNav}
        <button type="button" className="room-link" onClick={() => fly('room')}>
          ← Room
        </button>
        <button
          ref={finishOpen}
          type="button"
          className="finish-open"
          aria-haspopup="dialog"
          aria-expanded={finishes}
          aria-controls="room-finishes"
          onClick={() => (finishes ? closeFinishes() : openFinishes())}
        >
          <span className="swatch" style={swatchOf(theme)} aria-hidden="true" />
          <span className="finish-open-text" aria-live="polite">
            <span className="finish-open-kicker">Finish</span>
            <b>{theme.name}</b>
          </span>
          <span className="finish-open-cta">
            Change <Arrow out={false} />
          </span>
        </button>
        <a
          className="room-link"
          href={`${MAIN}/en/contact`}
          onClick={(e) => {
            if (!onContact || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return linkOut('contacts-click')(e)
            e.preventDefault()
            void narrator.say('contacts-click', { priority: 3 })
            onContact()
          }}
        >
          Build this kitchen <Arrow />
        </a>
      </div>

      {/* The finishes: a terracotta popup of their own, like the menu (phones: across the bottom; desktop: bottom left). */}
      <div className="room-finishes-catch" data-on={finishes || undefined} onClick={closeFinishes} aria-hidden="true" />
      <div
        id="room-finishes"
        ref={finishPanel}
        className="room-finishes"
        data-on={finishes || undefined}
        inert={!finishes}
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-finishes-title"
      >
        <div className="finishes-top">
          <p id="room-finishes-title" className="finishes-title">
            Finishes <span>{String(themes.length).padStart(2, '0')}</span>
          </p>
          <button type="button" className="panel-close" onClick={closeFinishes}>
            Close <span className="panel-x" aria-hidden="true" />
          </button>
        </div>
        <div className="finishes-list" role="radiogroup" aria-label="Kitchen finish" onKeyDown={onFinishKey}>
          {themes.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === theme.id}
              tabIndex={t.id === theme.id ? 0 : -1}
              className="finishes-item"
              style={{ '--i': i } as CSSProperties}
              onClick={() => chooseFinish(t.id)}
            >
              <span className="swatch" style={swatchOf(t)} aria-hidden="true" />
              <span className="finishes-text">
                <b>{t.name}</b>
                <span>{t.note}</span>
              </span>
              <i className="finishes-radio" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {/* The gallery wall close-up. */}
      <div
        ref={(el) => {
          sheets.current.gallery = el
        }}
        className="room-bar"
        data-on={view === 'gallery' || undefined}
        inert={view !== 'gallery'}
      >
        <button type="button" className="room-link" onClick={() => fly('room')}>
          ← Room
        </button>
        <p className="finish-name">
          <b>The gallery wall</b>
          <span>Four kitchens from our workshop in Tbilisi.</span>
        </p>
        <a className="room-link" href={`${MAIN}/en/gallery`} onClick={linkOut('gallery-leave')}>
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
          <button type="button" className="room-link" onClick={stay}>
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
          <a className="room-link room-link-gallery" href={`${MAIN}/en/gallery`} onClick={linkOut('gallery-leave')}>
            Gallery <Arrow />
          </a>
          <button ref={menuButton} type="button" className="room-link" aria-expanded={menu} aria-controls="room-menu" onClick={openMenu}>
            Menu
          </button>
        </div>
      </header>

      {/* The menu: half the screen in one flat colour, terracotta in the sketch room, white in the realistic one. */}
      <div className="room-scrim" data-on={menu || undefined} onClick={closeMenu} aria-hidden="true" />
      <aside id="room-menu" ref={panel} className="room-panel" data-on={menu || undefined} inert={!menu} aria-label="Menu">
        <div className="panel-top">
          <p className="panel-kicker">Menu</p>
          <button ref={panelClose} type="button" className="panel-close" onClick={closeMenu}>
            Close <span className="panel-x" aria-hidden="true" />
          </button>
        </div>
        <nav className="panel-nav" aria-label="In the room" onPointerLeave={() => point(menuAt >= 0 ? menuAt : null)}>
          <span ref={indicator} className="panel-indicator" aria-hidden="true" />
          {MENU_ITEMS.map((m, i) => {
            const inner = (
              <>
                <span className="panel-n">{m.n}</span>
                <span className="panel-label">
                  {m.label}
                  {m.href && <Arrow />}
                </span>
                <span className="panel-note">{m.note}</span>
              </>
            )
            const props = {
              className: 'panel-item',
              style: { '--i': i } as CSSProperties,
              'data-current': (m.view !== undefined && m.view === view) || undefined,
              'data-pointed': pointed === i || undefined,
              ref: (el: HTMLElement | null) => {
                items.current[i] = el
              },
              onPointerEnter: () => point(i),
              onFocus: () => point(i),
            }
            return m.href ? (
              <a key={m.n} {...props} href={`${MAIN}${m.href}`} onClick={linkOut('contacts-click')}>
                {inner}
              </a>
            ) : (
              <button key={m.n} type="button" {...props} onClick={() => m.view && fly(m.view)}>
                {inner}
              </button>
            )
          })}
        </nav>
        <div className="panel-foot">
          <div className="panel-extras">
            <button type="button" className="panel-switch" role="switch" aria-checked={voice} onClick={() => setVoice((v) => !v)}>
              <span>Narrator&apos;s voice</span>
              <i aria-hidden="true" />
            </button>
            <button
              type="button"
              className="panel-extra"
              onClick={() => {
                closeMenu()
                void narrator.say('replay-intro', { priority: 3 })
                onReplay()
              }}
            >
              Replay intro
            </button>
            <a className="panel-extra" href={MAIN}>
              kenchogroup.ge <Arrow />
            </a>
          </div>
          {/* What this browser remembers (kept on this device only), and a way to forget it. */}
          <p className="panel-memory">
            {(() => {
              const t = tracker.get()
              const minutes = Math.max(1, Math.round(t.timeSpent / 60000))
              const finish = t.lastFinish ? themes.find((x) => x.id === t.lastFinish)?.name : null
              return `Remembered on this device: visit ${t.visits}, ${minutes} min here${finish ? `, ${finish}` : ''}.`
            })()}{' '}
            <button
              type="button"
              className="panel-forget"
              onClick={() => {
                tracker.forget()
                setForgotten((n) => n + 1)
              }}
            >
              Forget me
            </button>
          </p>
        </div>
      </aside>

      <p className="room-hint room-chrome" data-hidden={view === 'door' || finishes || (mobile && view === 'room') || undefined}>
        <span aria-hidden="true" />
        {hint}
      </p>
    </section>
  )
}
