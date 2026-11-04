import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PhotoKey } from '@/lib/scene-assets'

/*
 * The hand-drawn room, built in code: a big retro living room with the
 * kitchen along the back wall, drawn like a designer's presentation board:
 * ink strokes (overshooting at the corners) over flat colour washes. Every
 * wash belongs to a material key, so the kitchen can change finish live.
 * Units are metres; the camera stands at the room's open front edge.
 */
type V3 = [number, number, number]

export type KitchenPart = 'cabinets' | 'fronts' | 'worktop' | 'tile' | 'shelf'
export type RoomKey =
  | 'wall'
  | 'wallSide'
  | 'floor'
  | 'glass'
  | 'curtain'
  | 'door'
  | 'frame'
  | 'shop'
  | 'shopSide'
  | 'shopFloor'
  | 'peg'
  | 'stool'
  | 'ceiling'
  | 'plinth'
  | 'appliance'
  | 'steel'
  | 'media'
  | 'walnut'
  | 'tv'
  | 'rug'
  | 'leather'
  | 'pot'
  | 'art1'
  | 'art2'
  | 'art3'
export type FillKey = KitchenPart | RoomKey
export type Zone = 'kitchen' | 'door' | 'media' | 'gallery'
export type NotePart = Exclude<KitchenPart, 'shelf'>

export const PAPER = '#f4f2ec'

/* The living room's fixed retro palette (sRGB). */
export const ROOM_COLORS: Record<RoomKey, string> = {
  wall: '#efe5d3',
  wallSide: '#e4d6bf',
  floor: '#dcc29a',
  glass: '#d3ddd6',
  curtain: '#d9a94f',
  door: '#d29b42',
  frame: '#2f2b27',
  shop: '#4a3f35',
  shopSide: '#41372f',
  shopFloor: '#5d4d3f',
  peg: '#9a7d60',
  stool: '#d8d2c7',
  ceiling: '#f2eee6',
  plinth: '#9c8670',
  appliance: '#2b2a27',
  steel: '#c5c8c3',
  media: '#c79c69',
  walnut: '#7b5437',
  tv: '#24221e',
  rug: '#b5603b',
  leather: '#94552f',
  pot: '#c06e47',
  art1: '#d6a048',
  art2: '#6f8f86',
  art3: '#c4684a',
}

export const KITCHEN_PARTS: KitchenPart[] = ['cabinets', 'fronts', 'worktop', 'tile', 'shelf']
export const FILL_KEYS = [...KITCHEN_PARTS, ...(Object.keys(ROOM_COLORS) as RoomKey[])] as FillKey[]

export interface KitchenTheme {
  id: string
  name: string
  note: string
  colors: Record<KitchenPart, string>
  /** what each finish is, for the board and the annotations */
  names: Record<NotePart, string>
}

export const KITCHEN_THEMES: KitchenTheme[] = [
  {
    id: 'sage',
    name: 'Sage & oak',
    note: 'Matte sage over light oak, quartz on top.',
    colors: { cabinets: '#8e9b85', fronts: '#cba57a', worktop: '#ece8df', tile: '#e9e2d4', shelf: '#cba57a' },
    names: { cabinets: 'Matte sage lacquer', fronts: 'Light oak veneer', worktop: 'Quartz stone', tile: 'Fluted cream tile' },
  },
  {
    id: 'forest',
    name: 'Forest green',
    note: 'Deep forest green with walnut and marble.',
    colors: { cabinets: '#3e5848', fronts: '#7a5337', worktop: '#e9e5dc', tile: '#dde2d8', shelf: '#7a5337' },
    names: { cabinets: 'Forest green lacquer', fronts: 'American walnut', worktop: 'Calacatta marble', tile: 'Pale green zellige' },
  },
  {
    id: 'white',
    name: 'Warm white',
    note: 'Warm white with honey oak and travertine.',
    colors: { cabinets: '#f0eadf', fronts: '#d5b88e', worktop: '#cac2b5', tile: '#f4f0e8', shelf: '#d5b88e' },
    names: { cabinets: 'Warm white lacquer', fronts: 'Honey oak', worktop: 'Grey travertine', tile: 'Gloss white tile' },
  },
  {
    id: 'greige',
    name: 'Greige & graphite',
    note: 'Soft greige with graphite and pale quartz.',
    colors: { cabinets: '#b3aa9b', fronts: '#4a4744', worktop: '#efebe4', tile: '#e2dbcf', shelf: '#8b7864' },
    names: { cabinets: 'Greige matte', fronts: 'Graphite matte', worktop: 'Pale quartz', tile: 'Stone tile' },
  },
  {
    id: 'terracotta',
    name: 'Retro terracotta',
    note: 'A seventies terracotta and cream, terrazzo on top.',
    colors: { cabinets: '#c06a4a', fronts: '#eadcc3', worktop: '#efe6d6', tile: '#e8d2b2', shelf: '#b5885a' },
    names: { cabinets: 'Terracotta lacquer', fronts: 'Cream lacquer', worktop: 'Terrazzo', tile: 'Sand tile' },
  },
]

export interface Stroke {
  a: V3
  b: V3
  /** 0 = faint pencil, 1 = full ink */
  tone: number
  /** draw a second, lighter pass over the stroke */
  double: boolean
  /** coloured pencil instead of ink (sRGB 0..1) */
  color?: V3
}

export interface Layer {
  strokes: Stroke[]
  fills: Partial<Record<FillKey, THREE.BufferGeometry>>
}

export interface SketchModel {
  main: Layer
  /** the workshop door's leaf, drawn around its hinge so it can swing */
  door: Layer
  hinge: V3
  anchors: Record<string, THREE.Vector3>
  /** clickable volumes */
  zones: Record<Zone, { min: V3; max: V3 }>
  /** the kitchen's parts, hoverable in the close-up */
  parts: Array<{ part: NotePart; min: V3; max: V3 }>
  /** real kitchen photographs hung on the gallery wall (x = their face) */
  photos: Array<{ key: PhotoKey; x: number; y0: number; y1: number; z0: number; z1: number }>
}

export const ROOM = { w: 9, d: 7, h: 2.9 }
const X0 = -ROOM.w / 2
const X1 = ROOM.w / 2
const Z0 = -ROOM.d / 2
const Z1 = ROOM.d / 2
const H = ROOM.h
const LEAF: V3 = [0.36, 0.48, 0.3]
const CREAM: V3 = [0.94, 0.87, 0.74]
const ORANGE: V3 = [0.86, 0.46, 0.2]

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* Flat, designer's shading: tops lit, fronts a touch down, sides darker. */
function faceShade(x: number, y: number, z: number) {
  if (y > 0.5) return 1
  if (y < -0.5) return 0.6
  if (Math.abs(x) > 0.5) return 0.78
  return z > 0 ? 0.9 : 0.8
}

class Builder {
  strokes: Stroke[] = []
  private fills: Partial<Record<FillKey, THREE.BufferGeometry[]>> = {}
  private rnd: () => number

  constructor(seed = 7) {
    this.rnd = seeded(seed)
  }

  line(a: V3, b: V3, tone = 0.9, double = true, color?: V3) {
    this.strokes.push({ a, b, tone, double, color })
  }

  /** a polyline through points */
  path(points: V3[], tone = 0.9, double = true, color?: V3) {
    for (let i = 0; i < points.length - 1; i++) this.line(points[i], points[i + 1], tone, double, color)
  }

  /** a flat colour wash with no strokes of its own (walls, floor, glass) */
  wash(min: V3, max: V3, key: FillKey) {
    this.fill(min, max, key, 1)
  }

  private fill(min: V3, max: V3, key: FillKey, shade?: number) {
    const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
    g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
    this.add(g, key, shade)
  }

  private add(geometry: THREE.BufferGeometry, key: FillKey, shade?: number) {
    const g = geometry.toNonIndexed()
    const n = g.getAttribute('normal')
    const c = new Float32Array(n.count * 3)
    for (let i = 0; i < n.count; i++) c.fill(shade ?? faceShade(n.getX(i), n.getY(i), n.getZ(i)), i * 3, i * 3 + 3)
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    ;(this.fills[key] ??= []).push(g)
  }

  /** an axis-aligned box: 12 ink edges over a shaded colour fill */
  box(min: V3, max: V3, key: FillKey | null, tone = 0.9) {
    const [x0, y0, z0] = min
    const [x1, y1, z1] = max
    const c: V3[] = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ]
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ]
    for (const [i, j] of edges) this.line(c[i], c[j], tone)
    if (key) this.fill(min, max, key)
  }

  /** vertical divisions across a box's front face (z = zf), e.g. door joints */
  doors(x0: number, x1: number, y0: number, y1: number, zf: number, count: number, tone = 0.7) {
    const step = (x1 - x0) / count
    for (let i = 1; i < count; i++) this.line([x0 + step * i, y0, zf], [x0 + step * i, y1, zf], tone, false)
    // a small pull on each door
    for (let i = 0; i < count; i++) {
      const cx = x0 + step * (i + 0.5) + (i % 2 ? -step * 0.32 : step * 0.32)
      const top = y1 - Math.min(0.12, (y1 - y0) * 0.2)
      this.line([cx, top, zf + 0.004], [cx, top - 0.12, zf + 0.004], tone * 0.9, false)
    }
  }

  /** a closed rectangle on a plane */
  rect(a: V3, b: V3, c: V3, d: V3, tone = 0.8, double = true) {
    this.path([a, b, c, d, a], tone, double)
  }

  /** a ring (polygon) in a horizontal plane */
  ring(cx: number, y: number, cz: number, r: number, tone = 0.8, seg = 14, color?: V3) {
    const pts: V3[] = []
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2
      pts.push([cx + Math.cos(t) * r, y, cz + Math.sin(t) * r])
    }
    this.path(pts, tone, false, color)
  }

  /** diagonal pencil hatching across a floor patch */
  hatchFloor(x0: number, x1: number, z0: number, z1: number, spacing = 0.07, tone = 0.32, y = 0.003) {
    for (let x = x0 - (z1 - z0); x < x1; x += spacing) {
      const ax = Math.max(x0, x)
      const az = z0 + (ax - x)
      const bx = Math.min(x1, x + (z1 - z0))
      const bz = z0 + (bx - x)
      if (bx > ax + 0.02) this.line([ax, y, az], [bx, y, bz], tone * (0.7 + this.rnd() * 0.4), false)
    }
  }

  /** hatching on a vertical face facing +z */
  hatchWall(x0: number, x1: number, y0: number, y1: number, z: number, spacing = 0.06, tone = 0.3) {
    for (let x = x0 - (y1 - y0); x < x1; x += spacing) {
      const ax = Math.max(x0, x)
      const ay = y0 + (ax - x)
      const bx = Math.min(x1, x + (y1 - y0))
      const by = y0 + (bx - x)
      if (bx > ax + 0.02) this.line([ax, ay, z], [bx, by, z], tone * (0.7 + this.rnd() * 0.4), false)
    }
  }

  get random() {
    return this.rnd
  }

  layer(): Layer {
    const fills: Layer['fills'] = {}
    for (const [key, list] of Object.entries(this.fills) as Array<[FillKey, THREE.BufferGeometry[]]>) {
      fills[key] = mergeGeometries(list, false)
    }
    return { strokes: this.strokes, fills }
  }
}

export function buildRoom(): SketchModel {
  const s = new Builder()
  const r = s.random

  // ---- the shell: washes, then the ink ------------------------------------
  s.wash([X0, -0.02, Z0], [X1, 0, Z1], 'floor')
  // the back wall, with the workshop doorway left open
  s.wash([X0, 0, Z0 - 0.03], [0.38, H, Z0], 'wall')
  s.wash([1.37, 0, Z0 - 0.03], [X1, H, Z0], 'wall')
  s.wash([0.38, 2.17, Z0 - 0.03], [1.37, H, Z0], 'wall')
  // the ceiling: only shown on phones, where the camera stands inside the room
  s.wash([X0, H, Z0], [X1, H + 0.03, Z1], 'ceiling')
  s.wash([X0 - 0.03, 0, Z0], [X0, H, Z1], 'wallSide')
  s.wash([X1, 0, Z0], [X1 + 0.03, H, Z1], 'wallSide')
  s.line([X0, 0, Z0], [X1, 0, Z0], 1)
  s.line([X0, 0, Z0], [X0, 0, Z1], 1)
  s.line([X1, 0, Z0], [X1, 0, Z1], 1)
  s.line([X0, 0, Z0], [X0, H, Z0], 1)
  s.line([X1, 0, Z0], [X1, H, Z0], 1)
  s.line([X0, H, Z0], [X1, H, Z0], 0.85)
  s.line([X0, H, Z0], [X0, H, Z1], 0.7)
  s.line([X1, H, Z0], [X1, H, Z1], 0.7)

  // Window wall (right): glazing, mullions, a sill, far rooftops, a curtain.
  const wx = X1 - 0.006
  s.wash([X1 - 0.004, 0.35, -2.6], [X1, 2.55, 1.3], 'glass')
  s.rect([wx, 0.35, -2.6], [wx, 0.35, 1.3], [wx, 2.55, 1.3], [wx, 2.55, -2.6], 0.95)
  for (const z of [-1.3, 0.0]) s.line([wx, 0.35, z], [wx, 2.55, z], 0.75)
  s.line([wx - 0.12, 0.32, -2.7], [wx - 0.12, 0.32, 1.4], 0.7)
  s.path([[wx, 0.9, -2.5], [wx, 1.15, -2.1], [wx, 1.15, -1.7], [wx, 0.95, -1.4]], 0.28, false)
  s.path([[wx, 0.8, -0.2], [wx, 1.25, 0.15], [wx, 1.05, 0.6], [wx, 1.05, 1.2]], 0.28, false)
  s.line([X1 - 0.09, 2.72, -3.2], [X1 - 0.09, 2.72, 1.5], 0.8)
  s.wash([X1 - 0.075, 0.06, -3.1], [X1 - 0.02, 2.7, -2.62], 'curtain')
  s.rect([X1 - 0.076, 0.06, -3.1], [X1 - 0.076, 2.7, -3.1], [X1 - 0.076, 2.7, -2.62], [X1 - 0.076, 0.06, -2.62], 0.75)
  for (const z of [-2.98, -2.86, -2.74]) s.line([X1 - 0.077, 0.1, z], [X1 - 0.077, 2.66, z], 0.35, false)

  // Gallery wall (left): four of our kitchens, framed (Room adds the photos).
  const fx = X0 + 0.04
  const photos: SketchModel['photos'] = []
  const hang = (key: PhotoKey, z0: number, z1: number, y0: number, y1: number) => {
    s.box([X0, y0 - 0.035, z0 - 0.035], [fx, y1 + 0.035, z1 + 0.035], 'frame', 0.9)
    photos.push({ key, x: fx + 0.003, y0, y1, z0, z1 })
  }
  hang('kitchen', -2.55, -1.55, 1.72, 2.387)
  hang('forest', -1.35, -0.35, 1.72, 2.387)
  hang('white', -2.55, -1.55, 0.88, 1.547)
  hang('greige', -1.35, -0.35, 0.88, 1.547)
  // a slim picture ledge under the hang
  s.box([X0, 0.74, -2.7], [X0 + 0.12, 0.77, -0.2], 'walnut', 0.8)

  // Floorboards (faint, slightly ragged lengths).
  for (let x = X0 + 0.55; x < X1; x += 0.55) {
    const zStart = Z0 + r() * 0.4
    s.line([x, 0.002, zStart], [x, 0.002, Z1 - r() * 1.2], 0.2, false)
  }

  // ---- the kitchen (back wall, left) ---------------------------------------
  const zFront = Z0 + 0.6
  // Tall units with a built-in oven.
  s.box([-4.4, 0, Z0], [-3.2, 2.4, zFront], 'cabinets')
  s.doors(-4.4, -3.2, 0.08, 2.4, zFront, 2)
  s.box([-4.32, 0.9, zFront], [-3.86, 1.48, zFront + 0.015], 'appliance', 0.85)
  s.line([-4.27, 1.4, zFront + 0.017], [-3.91, 1.4, zFront + 0.017], 0.2, false)
  // Base run: plinth, doors, worktop, hob and sink.
  s.box([-3.2, 0, Z0], [0.2, 0.1, zFront - 0.06], 'plinth', 0.6)
  s.box([-3.2, 0.1, Z0], [0.2, 0.88, zFront - 0.02], 'fronts')
  s.doors(-3.2, 0.2, 0.12, 0.86, zFront - 0.02, 6)
  s.box([-3.22, 0.88, Z0], [0.22, 0.92, zFront + 0.02], 'worktop')
  s.box([-1.56, 0.92, -3.42], [-0.94, 0.926, -2.95], 'appliance', 0.8)
  for (const [hx, hz] of [[-1.4, -3.07], [-1.1, -3.07], [-1.4, -3.3], [-1.1, -3.3]] as const) s.ring(hx, 0.928, hz, 0.08, 0.18, 10)
  s.box([-2.7, 0.92, -3.32], [-2.15, 0.924, -3.0], 'steel', 0.7)
  s.path([[-2.42, 0.925, -3.4], [-2.42, 1.18, -3.4], [-2.42, 1.18, -3.18]], 0.85, false)
  // Fluted tile splashback.
  s.wash([-3.2, 0.92, Z0], [0.2, 1.45, Z0 + 0.006], 'tile')
  for (let x = -3.12; x < 0.18; x += 0.09) s.line([x, 0.93, Z0 + 0.007], [x, 1.44, Z0 + 0.007], 0.22, false)
  // Wall cabinets, then open shelves with books and a jar.
  s.box([-3.2, 1.45, Z0], [-0.4, 2.25, Z0 + 0.36], 'cabinets')
  s.doors(-3.2, -0.4, 1.45, 2.25, Z0 + 0.36, 4)
  s.hatchWall(-3.2, -0.4, 1.33, 1.45, Z0 + 0.008, 0.05, 0.28)
  for (const y of [1.55, 1.85, 2.15]) s.box([-0.4, y, Z0], [0.2, y + 0.035, Z0 + 0.3], 'shelf', 0.8)
  s.box([-0.3, 1.885, Z0 + 0.04], [-0.25, 2.1, Z0 + 0.24], 'art1', 0.75)
  s.box([-0.25, 1.885, Z0 + 0.04], [-0.19, 2.06, Z0 + 0.24], 'art2', 0.75)
  s.box([-0.19, 1.885, Z0 + 0.04], [-0.15, 2.12, Z0 + 0.24], 'art3', 0.75)
  s.path([[0.0, 1.585, Z0 + 0.15], [-0.03, 1.66, Z0 + 0.15], [0.02, 1.74, Z0 + 0.15], [0.1, 1.74, Z0 + 0.15], [0.15, 1.66, Z0 + 0.15], [0.12, 1.585, Z0 + 0.15]], 0.75, false)

  // Island: fluted front, worktop, a fruit bowl, stools and pendants.
  s.box([-2.7, 0, -1.75], [-0.4, 0.9, -0.85], 'fronts')
  for (let x = -2.62; x < -0.45; x += 0.08) s.line([x, 0.04, -0.849], [x, 0.86, -0.849], 0.3, false)
  s.box([-2.78, 0.9, -1.8], [-0.32, 0.95, -0.8], 'worktop')
  s.hatchFloor(-2.75, -0.35, -0.85, -0.5, 0.06, 0.3)
  s.ring(-2.1, 0.955, -1.32, 0.16, 0.8, 14)
  for (const [ox, oz] of [[-0.05, -0.04], [0.06, 0.02], [-0.01, 0.07]] as const) s.ring(-2.1 + ox, 0.99, -1.32 + oz, 0.05, 0.9, 8, ORANGE)
  s.box([-1.22, 0.95, -1.42], [-1.06, 0.958, -1.33], 'appliance', 0.75)
  // Pendants over the island.
  for (const sx of [-2.2, -1.55, -0.9]) {
    const pz = -1.3
    s.line([sx, H, pz], [sx, 1.78, pz], 0.55, false)
    s.ring(sx, 1.62, pz, 0.13, 0.8, 12)
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2
      s.line([sx, 1.78, pz], [sx + Math.cos(t) * 0.13, 1.62, pz + Math.sin(t) * 0.13], 0.55, false)
    }
  }
  // Slim counter stools, as in our warm-white kitchen: an upholstered seat
  // and tall back on four thin legs, with a square footrest.
  for (const sx of [-2.2, -1.55, -0.9]) {
    const sz = -0.4
    s.box([sx - 0.2, 0.68, sz - 0.2], [sx + 0.2, 0.75, sz + 0.2], 'stool', 0.8)
    s.box([sx - 0.19, 0.75, sz + 0.15], [sx + 0.19, 1.1, sz + 0.2], 'stool', 0.8)
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      s.line([sx + lx * 0.17, 0.68, sz + lz * 0.17], [sx + lx * 0.19, 0.013, sz + lz * 0.19], 0.9, false)
    }
    const f = 0.18
    s.rect([sx - f, 0.28, sz - f], [sx + f, 0.28, sz - f], [sx + f, 0.28, sz + f], [sx - f, 0.28, sz + f], 0.7, false)
  }

  // ---- the workshop door (back wall, between kitchen and living) ----------
  // an oak architrave round an open doorway; the leaf is its own layer
  s.wash([0.38, 0, Z0], [0.45, 2.17, Z0 + 0.012], 'media')
  s.wash([1.3, 0, Z0], [1.37, 2.17, Z0 + 0.012], 'media')
  s.wash([0.45, 2.1, Z0], [1.3, 2.17, Z0 + 0.012], 'media')
  s.rect([0.38, 0, Z0 + 0.013], [0.38, 2.17, Z0 + 0.013], [1.37, 2.17, Z0 + 0.013], [1.37, 0, Z0 + 0.013], 0.95)
  s.path([[0.45, 0, Z0 + 0.013], [0.45, 2.1, Z0 + 0.013], [1.3, 2.1, Z0 + 0.013], [1.3, 0, Z0 + 0.013]], 0.8, false)

  // ---- the workshop behind it (only seen through the door) ----------------
  const WZ = Z0 - 3.2
  const WX0 = -0.6
  const WX1 = 2.4
  s.wash([WX0, -0.02, WZ], [WX1, 0, Z0], 'shopFloor')
  s.wash([WX0, 0, WZ - 0.03], [WX1, H, WZ], 'shop')
  s.wash([WX0 - 0.03, 0, WZ], [WX0, H, Z0], 'shopSide')
  s.wash([WX1, 0, WZ], [WX1 + 0.03, H, Z0], 'shopSide')
  s.wash([WX0, H, WZ], [WX1, H + 0.03, Z0], 'shopSide')
  for (const x of [WX0, WX1]) {
    s.line([x, 0, WZ], [x, H, WZ], 0.15, false)
    s.line([x, 0, WZ], [x, 0, Z0], 0.15, false)
  }
  s.line([WX0, 0, WZ], [WX1, 0, WZ], 0.15, false)
  for (let x = WX0 + 0.4; x < WX1; x += 0.4) s.line([x, 0.002, WZ], [x, 0.002, Z0], 0.1, false)
  // a workbench with a lower shelf of offcuts
  s.box([-0.2, 0.86, WZ], [1.95, 0.93, WZ + 0.75], 'media', 0.35)
  for (const [lx, lz] of [[-0.15, WZ + 0.05], [1.9, WZ + 0.05], [1.9, WZ + 0.7], [-0.15, WZ + 0.7]] as const) s.line([lx, 0.86, lz], [lx, 0, lz], 0.2, false)
  s.box([-0.15, 0.24, WZ + 0.05], [1.9, 0.28, WZ + 0.7], 'media', 0.35)
  for (const x of [0.1, 0.45, 0.8]) s.box([x, 0.28, WZ + 0.12], [x + 0.28, 0.34, WZ + 0.6], 'walnut', 0.35)
  s.box([1.55, 0.93, WZ + 0.3], [1.75, 1.03, WZ + 0.55], 'appliance', 0.3)
  // a pegboard with tools
  s.wash([0.0, 1.15, WZ], [1.75, 2.1, WZ + 0.01], 'peg')
  const pz = WZ + 0.012
  s.path([[0.15, 1.95, pz], [0.55, 1.8, pz], [0.55, 1.62, pz], [0.15, 1.77, pz], [0.15, 1.95, pz]], 0.85, false)
  s.line([0.75, 1.98, pz], [0.75, 1.55, pz], 0.85, false)
  s.line([0.68, 1.98, pz], [0.84, 1.98, pz], 0.85, false)
  s.path([[1.0, 1.98, pz], [1.0, 1.5, pz], [1.3, 1.5, pz]], 0.85, false)
  for (const x of [1.45, 1.52, 1.59]) s.line([x, 1.95, pz], [x, 1.62, pz], 0.85, false)
  s.line([0.0, 1.15, pz], [1.75, 1.15, pz], 0.4, false)
  // a lumber rack along the right wall
  for (let i = 0; i < 4; i++) {
    const y = 0.55 + i * 0.4
    s.box([2.12, y, WZ + 0.2], [2.38, y + 0.06, Z0 - 0.35], 'media', 0.3)
  }
  // a cabinet door blank resting on two trestles
  s.box([0.25, 0.68, Z0 - 2.1], [1.5, 0.72, Z0 - 1.45], 'door', 0.3)
  for (const x of [0.4, 1.35]) {
    s.line([x, 0.68, Z0 - 2.05], [x - 0.08, 0, Z0 - 2.05], 0.2, false)
    s.line([x, 0.68, Z0 - 1.5], [x - 0.08, 0, Z0 - 1.5], 0.2, false)
  }
  // a pendant over the bench
  s.line([0.9, H, WZ + 0.4], [0.9, 1.85, WZ + 0.4], 0.15, false)
  s.ring(0.9, 1.72, WZ + 0.4, 0.16, 0.12, 12)
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * Math.PI * 2
    s.line([0.9, 1.85, WZ + 0.4], [0.9 + Math.cos(t) * 0.16, 1.72, WZ + 0.4 + Math.sin(t) * 0.16], 0.12, false)
  }

  // ---- the living area (right) ---------------------------------------------
  // Fluted media wall with a TV and a floating cabinet.
  s.box([1.55, 0, Z0], [4.4, 2.6, Z0 + 0.08], 'media')
  for (let x = 1.67; x < 4.35; x += 0.12) s.line([x, 0.02, Z0 + 0.081], [x, 2.58, Z0 + 0.081], 0.3, false)
  s.box([2.2, 1.15, Z0 + 0.08], [3.7, 1.95, Z0 + 0.12], 'tv')
  s.line([2.35, 1.85, Z0 + 0.123], [2.6, 1.6, Z0 + 0.123], 0.22, false)
  s.line([2.45, 1.88, Z0 + 0.123], [2.62, 1.71, Z0 + 0.123], 0.22, false)
  s.box([1.95, 0.25, Z0 + 0.08], [3.95, 0.62, Z0 + 0.52], 'walnut')
  s.doors(1.95, 3.95, 0.25, 0.62, Z0 + 0.52, 3)
  s.hatchWall(1.95, 3.95, 0.12, 0.25, Z0 + 0.082, 0.05, 0.28)

  // Rug (with woven stripes), coffee table, a lounge chair and an arc lamp.
  s.wash([1.3, 0, -2.2], [4.1, 0.012, 0.9], 'rug')
  s.rect([1.3, 0.013, -2.2], [4.1, 0.013, -2.2], [4.1, 0.013, 0.9], [1.3, 0.013, 0.9], 0.6)
  for (const z of [-1.98, -1.88, 0.58, 0.68]) s.line([1.45, 0.013, z], [3.95, 0.013, z], 0.8, false, CREAM)
  s.box([2.25, 0.34, -1.1], [3.55, 0.4, -0.3], 'walnut')
  for (const [lx, lz] of [[2.35, -1.0], [3.45, -1.0], [3.45, -0.4], [2.35, -0.4]] as const) {
    s.line([lx, 0.34, lz], [lx, 0.013, lz], 0.8, false)
  }
  s.hatchFloor(2.3, 3.5, -1.05, -0.35, 0.08, 0.25, 0.014)
  s.box([2.55, 0.4, -0.88], [2.9, 0.43, -0.62], 'art2', 0.75)
  s.path([[3.2, 0.4, -0.7], [3.17, 0.5, -0.7], [3.21, 0.58, -0.7], [3.27, 0.58, -0.7], [3.31, 0.5, -0.7], [3.28, 0.4, -0.7]], 0.75, false)
  s.box([3.3, 0.32, 0.05], [4.0, 0.42, 0.75], 'leather')
  s.box([3.3, 0.42, 0.66], [4.0, 0.92, 0.75], 'leather')
  for (const [lx, lz] of [[3.33, 0.08], [3.97, 0.08], [3.97, 0.72], [3.33, 0.72]] as const) {
    s.line([lx, 0.32, lz], [lx + (lx < 3.6 ? -0.04 : 0.04), 0.013, lz + (lz < 0.4 ? -0.05 : 0.05)], 0.8, false)
  }
  const arc: V3[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const u = 1 - t
    arc.push([
      u * u * 4.18 + 2 * u * t * 4.25 + t * t * 3.45,
      u * u * 0.02 + 2 * u * t * 2.75 + t * t * 2.1,
      u * u * 1.15 + 2 * u * t * 0.95 + t * t * 0.3,
    ])
  }
  s.path(arc, 0.85, false)
  s.ring(4.18, 0.015, 1.15, 0.16, 0.8, 12)
  s.ring(3.45, 1.9, 0.3, 0.22, 0.85, 14)
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * Math.PI * 2
    s.line([3.45, 2.1, 0.3], [3.45 + Math.cos(t) * 0.22, 1.9, 0.3 + Math.sin(t) * 0.22], 0.55, false)
  }

  // A plant by the window, in green pencil.
  s.box([3.98, 0, -3.1], [4.36, 0.4, -2.72], 'pot')
  const stems: Array<[number, number, number]> = [
    [0.0, 1.35, 0.0], [-0.22, 1.12, 0.1], [0.2, 1.2, -0.08], [0.1, 0.98, 0.22], [-0.14, 1.28, -0.2],
  ]
  for (const [ox, top, oz] of stems) {
    const base: V3 = [4.17, 0.4, -2.91]
    const mid: V3 = [4.17 + ox * 0.5, (0.4 + top) / 2, -2.91 + oz * 0.5]
    const tip: V3 = [4.17 + ox, top, -2.91 + oz]
    s.path([base, mid, tip], 0.6, false, LEAF)
    s.path([[mid[0] - 0.08, mid[1] + 0.1, mid[2]], mid, [mid[0] + 0.07, mid[1] + 0.12, mid[2] + 0.02]], 0.5, false, LEAF)
    s.path([[tip[0] - 0.09, tip[1] - 0.05, tip[2]], tip, [tip[0] + 0.08, tip[1] - 0.04, tip[2]]], 0.5, false, LEAF)
  }

  // ---- the door leaf, in its own layer around the hinge -------------------
  const d = new Builder(19)
  d.box([0, 0, 0], [0.85, 2.1, 0.04], 'door')
  d.wash([0.12, 0.5, 0.04], [0.22, 1.8, 0.043], 'glass')
  d.rect([0.12, 0.5, 0.044], [0.22, 0.5, 0.044], [0.22, 1.8, 0.044], [0.12, 1.8, 0.044], 0.75, false)
  for (const y of [0.3, 1.95]) d.line([0.06, y, 0.042], [0.79, y, 0.042], 0.35, false)
  d.box([0.72, 0.98, 0.04], [0.78, 1.04, 0.085], 'walnut', 0.85)

  return {
    main: s.layer(),
    door: d.layer(),
    hinge: [0.45, 0, Z0 + 0.006],
    photos,
    anchors: {
      kitchen: new THREE.Vector3(-1.8, 2.25, Z0 + 0.36),
      gallery: new THREE.Vector3(fx, 2.05, -0.85),
      about: new THREE.Vector3(1.05, 1.45, Z0 + 0.05),
      contact: new THREE.Vector3(3.95, 1.55, Z0 + 0.09),
      // kitchen close-up annotations
      cabinets: new THREE.Vector3(-2.4, 1.95, Z0 + 0.37),
      tile: new THREE.Vector3(-0.75, 1.18, Z0 + 0.008),
      worktop: new THREE.Vector3(-0.75, 0.955, -1.15),
      fronts: new THREE.Vector3(-2.05, 0.45, -0.845),
      // photo captions sit at each print's lower left, as seen facing the wall
      ...Object.fromEntries(photos.map((p, i) => [`photo${i}`, new THREE.Vector3(p.x, p.y0, p.z1)])),
    },
    zones: {
      kitchen: { min: [-4.4, 0, Z0], max: [0.22, 2.4, -0.2] },
      door: { min: [0.38, 0, Z0], max: [1.37, 2.17, Z0 + 0.3] },
      media: { min: [1.55, 0, Z0], max: [4.4, 2.6, Z0 + 0.55] },
      gallery: { min: [X0, 0.7, -2.7], max: [X0 + 0.3, 2.45, -0.2] },
    },
    parts: [
      { part: 'cabinets', min: [-3.2, 1.45, Z0], max: [-0.4, 2.25, Z0 + 0.36] },
      { part: 'cabinets', min: [-4.4, 0, Z0], max: [-3.2, 2.4, zFront] },
      { part: 'tile', min: [-3.2, 0.92, Z0], max: [0.2, 1.45, Z0 + 0.02] },
      { part: 'worktop', min: [-3.22, 0.88, Z0], max: [0.22, 0.93, zFront + 0.02] },
      { part: 'worktop', min: [-2.78, 0.9, -1.8], max: [-0.32, 0.96, -0.8] },
      { part: 'fronts', min: [-3.2, 0, Z0], max: [0.2, 0.88, zFront] },
      { part: 'fronts', min: [-2.7, 0, -1.75], max: [-0.4, 0.9, -0.85] },
    ],
  }
}

/*
 * The strokes as flat arrays for LineSegmentsGeometry: one still drawing,
 * every stroke with a small fixed wobble and an architect's overshoot past
 * the corners. `double` strokes get a second, lighter pass.
 */
export function inkLines(strokes: Stroke[], seed = 101) {
  const rnd = seeded(seed)
  const pos: number[] = []
  const col: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const ink = new THREE.Color()
  const wobble = () => (rnd() - 0.5) * 0.016

  const push = (tone: number, scale: number, color?: V3) => {
    const len = a.distanceTo(b)
    dir.subVectors(b, a).normalize()
    const over = Math.min(0.09, 0.02 + len * 0.025) * scale
    const o1 = over * (0.4 + rnd())
    const o2 = over * (0.4 + rnd())
    pos.push(
      a.x - dir.x * o1 + wobble(),
      a.y - dir.y * o1 + wobble(),
      a.z - dir.z * o1 + wobble(),
      b.x + dir.x * o2 + wobble(),
      b.y + dir.y * o2 + wobble(),
      b.z + dir.z * o2 + wobble(),
    )
    if (color) {
      ink.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace)
    } else {
      // warm ink on paper: tone 1 = near-black, tone 0 = paper (sRGB, stored linear)
      const g = 0.95 - tone * 0.87
      ink.setRGB(g, g * 0.97, g * 0.92, THREE.SRGBColorSpace)
    }
    col.push(ink.r, ink.g, ink.b, ink.r, ink.g, ink.b)
  }

  for (const s of strokes) {
    a.set(...s.a)
    b.set(...s.b)
    push(s.tone, 1, s.color)
    if (s.double) push(s.tone * 0.55, 1.6, s.color)
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col) }
}
