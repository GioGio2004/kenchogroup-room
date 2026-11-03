import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * The hand-drawn room, built in code: a big living room with the kitchen
 * along the back wall. Everything is ink strokes (with an architect's
 * overshoot at the corners) over paper-white fills that hide what is behind.
 * Units are metres; the camera stands at the room's open front edge.
 */
type V3 = [number, number, number]

export interface Stroke {
  a: V3
  b: V3
  /** 0 = faint pencil, 1 = full ink */
  tone: number
  /** draw a second, lighter pass over the stroke */
  double: boolean
}

export interface SketchModel {
  strokes: Stroke[]
  fills: THREE.BufferGeometry
  darkFills: THREE.BufferGeometry
  anchors: Record<'gallery' | 'about' | 'contact', THREE.Vector3>
}

export const ROOM = { w: 9, d: 7, h: 2.9 }
const X0 = -ROOM.w / 2
const X1 = ROOM.w / 2
const Z0 = -ROOM.d / 2
const Z1 = ROOM.d / 2
const H = ROOM.h

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Builder {
  strokes: Stroke[] = []
  private fills: THREE.BufferGeometry[] = []
  private dark: THREE.BufferGeometry[] = []
  private rnd = seeded(7)

  line(a: V3, b: V3, tone = 0.9, double = true) {
    this.strokes.push({ a, b, tone, double })
  }

  /** a polyline through points */
  path(points: V3[], tone = 0.9, double = true) {
    for (let i = 0; i < points.length - 1; i++) this.line(points[i], points[i + 1], tone, double)
  }

  /** an axis-aligned box: 12 edges, plus a paper fill that hides what is behind */
  box(min: V3, max: V3, opts: { tone?: number; fill?: boolean; dark?: boolean } = {}) {
    const { tone = 0.9, fill = true, dark = false } = opts
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
    if (fill) {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
      ;(dark ? this.dark : this.fills).push(g.toNonIndexed())
    }
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
  ring(cx: number, y: number, cz: number, r: number, tone = 0.8, seg = 14) {
    const pts: V3[] = []
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2
      pts.push([cx + Math.cos(t) * r, y, cz + Math.sin(t) * r])
    }
    this.path(pts, tone, false)
  }

  /** diagonal pencil hatching across a floor patch */
  hatchFloor(x0: number, x1: number, z0: number, z1: number, spacing = 0.07, tone = 0.32) {
    for (let x = x0 - (z1 - z0); x < x1; x += spacing) {
      const ax = Math.max(x0, x)
      const az = z0 + (ax - x)
      const bx = Math.min(x1, x + (z1 - z0))
      const bz = z0 + (bx - x)
      if (bx > ax + 0.02) this.line([ax, 0.003, az], [bx, 0.003, bz], tone * (0.7 + this.rnd() * 0.4), false)
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

  build(anchors: SketchModel['anchors']): SketchModel {
    return {
      strokes: this.strokes,
      fills: mergeGeometries(this.fills, false),
      darkFills: mergeGeometries(this.dark, false),
      anchors,
    }
  }
}

export function buildRoom(): SketchModel {
  const s = new Builder()
  const r = s.random

  // ---- the shell ---------------------------------------------------------
  s.line([X0, 0, Z0], [X1, 0, Z0], 1)
  s.line([X0, 0, Z0], [X0, 0, Z1], 1)
  s.line([X1, 0, Z0], [X1, 0, Z1], 1)
  s.line([X0, 0, Z0], [X0, H, Z0], 1)
  s.line([X1, 0, Z0], [X1, H, Z0], 1)
  s.line([X0, H, Z0], [X1, H, Z0], 0.85)
  s.line([X0, H, Z0], [X0, H, Z1], 0.7)
  s.line([X1, H, Z0], [X1, H, Z1], 0.7)

  // Window wall (right): a tall glazed opening with mullions and a sill.
  const wx = X1 - 0.01
  s.rect([wx, 0.35, -2.6], [wx, 0.35, 1.3], [wx, 2.55, 1.3], [wx, 2.55, -2.6], 0.95)
  for (const z of [-1.3, 0.0]) s.line([wx, 0.35, z], [wx, 2.55, z], 0.75)
  s.line([wx, 0.35, -2.7], [wx - 0.12, 0.35, -2.7], 0.6, false)
  s.line([wx - 0.12, 0.32, -2.7], [wx - 0.12, 0.32, 1.4], 0.7)
  // a hint of the view: a few far rooftops
  s.path([[wx, 0.9, -2.5], [wx, 1.15, -2.1], [wx, 1.15, -1.7], [wx, 0.95, -1.4]], 0.28, false)
  s.path([[wx, 0.8, -0.2], [wx, 1.25, 0.15], [wx, 1.05, 0.6], [wx, 1.05, 1.2]], 0.28, false)

  // Workshop door (left wall, just past the kitchen).
  const dx = X0 + 0.01
  s.rect([dx, 0, -2.45], [dx, 2.15, -2.45], [dx, 2.15, -1.5], [dx, 0, -1.5], 0.95)
  s.rect([dx, 0.08, -2.37], [dx, 2.07, -2.37], [dx, 2.07, -1.58], [dx, 0.08, -1.58], 0.45, false)
  s.line([dx + 0.01, 1.05, -1.66], [dx + 0.01, 1.05, -1.8], 0.9, false)

  // Floorboards (faint, slightly ragged lengths).
  for (let x = X0 + 0.55; x < X1; x += 0.55) {
    const zStart = Z0 + r() * 0.4
    s.line([x, 0.002, zStart], [x, 0.002, Z1 - r() * 1.2], 0.18, false)
  }

  // ---- the kitchen (back wall, left half) --------------------------------
  const zBack = Z0
  const zFront = Z0 + 0.6
  // Tall units: oven column and larder.
  s.box([-4.4, 0, zBack], [-3.2, 2.4, zFront])
  s.doors(-4.4, -3.2, 0.08, 2.4, zFront, 2)
  s.rect([-4.32, 0.9, zFront + 0.003], [-3.86, 0.9, zFront + 0.003], [-3.86, 1.48, zFront + 0.003], [-4.32, 1.48, zFront + 0.003], 0.8, false)
  s.line([-4.27, 1.4, zFront + 0.004], [-3.91, 1.4, zFront + 0.004], 0.5, false)
  // Base run with plinth, worktop, hob and sink.
  s.box([-3.2, 0.1, zBack], [0.6, 0.88, zFront - 0.02])
  s.line([-3.2, 0.1, zFront - 0.06], [0.6, 0.1, zFront - 0.06], 0.4, false)
  s.doors(-3.2, 0.6, 0.12, 0.86, zFront - 0.02, 6)
  s.box([-3.22, 0.88, zBack], [0.62, 0.92, zFront + 0.02])
  for (const [hx, hz] of [[-1.4, -3.05], [-1.1, -3.05], [-1.4, -3.3], [-1.1, -3.3]] as const) s.ring(hx, 0.925, hz, 0.08, 0.55, 10)
  s.rect([-2.7, 0.925, -3.32], [-2.15, 0.925, -3.32], [-2.15, 0.925, -3.0], [-2.7, 0.925, -3.0], 0.7, false)
  s.path([[-2.42, 0.925, -3.4], [-2.42, 1.18, -3.4], [-2.42, 1.18, -3.18]], 0.8, false)
  // Wall cabinets and the under-cabinet shadow on the splashback.
  s.box([-3.2, 1.45, zBack], [0.6, 2.25, Z0 + 0.36])
  s.doors(-3.2, 0.6, 1.45, 2.25, Z0 + 0.36, 5)
  s.hatchWall(-3.2, 0.6, 1.32, 1.45, zBack + 0.002, 0.05, 0.3)

  // Island with fluted front, worktop and stools.
  s.box([-2.7, 0, -1.75], [-0.4, 0.9, -0.85])
  for (let x = -2.62; x < -0.45; x += 0.08) s.line([x, 0.04, -0.849], [x, 0.86, -0.849], 0.38, false)
  s.box([-2.78, 0.9, -1.8], [-0.32, 0.95, -0.8])
  s.hatchFloor(-2.75, -0.35, -0.85, -0.5, 0.06, 0.3)
  for (const sx of [-2.2, -1.55, -0.9]) {
    const sz = -0.42
    s.box([sx - 0.18, 0.72, sz - 0.18], [sx + 0.18, 0.77, sz + 0.18], { tone: 0.85 })
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      s.line([sx + lx * 0.15, 0.72, sz + lz * 0.15], [sx + lx * 0.2, 0, sz + lz * 0.2], 0.8, false)
    }
    s.rect([sx - 0.17, 0.28, sz - 0.17], [sx + 0.17, 0.28, sz - 0.17], [sx + 0.17, 0.28, sz + 0.17], [sx - 0.17, 0.28, sz + 0.17], 0.45, false)
    // Pendant over each stool.
    const pz = -1.3
    s.line([sx, H, pz], [sx, 1.78, pz], 0.55, false)
    s.ring(sx, 1.62, pz, 0.13, 0.8, 12)
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2
      s.line([sx, 1.78, pz], [sx + Math.cos(t) * 0.13, 1.62, pz + Math.sin(t) * 0.13], 0.55, false)
    }
  }
  // A phone on the island.
  s.box([-1.22, 0.95, -1.42], [-1.06, 0.958, -1.33], { tone: 0.75 })

  // ---- the living area (right half) --------------------------------------
  // Fluted media wall with a TV and a floating cabinet: Kencho's signature.
  s.box([1.0, 0, zBack], [4.4, 2.6, zBack + 0.08])
  for (let x = 1.12; x < 4.35; x += 0.12) s.line([x, 0.02, zBack + 0.081], [x, 2.58, zBack + 0.081], 0.3, false)
  s.box([1.9, 1.15, zBack + 0.08], [3.4, 1.95, zBack + 0.12], { dark: true })
  s.box([1.4, 0.25, zBack + 0.08], [3.9, 0.62, zBack + 0.52])
  s.doors(1.4, 3.9, 0.25, 0.62, zBack + 0.52, 3)
  s.hatchWall(1.4, 3.9, 0.12, 0.25, zBack + 0.082, 0.05, 0.28)

  // Rug, coffee table and a wooden lounge chair.
  s.rect([1.1, 0.004, -2.0], [4.0, 0.004, -2.0], [4.0, 0.004, 1.0], [1.1, 0.004, 1.0], 0.55)
  s.rect([1.25, 0.005, -1.85], [3.85, 0.005, -1.85], [3.85, 0.005, 0.85], [1.25, 0.005, 0.85], 0.25, false)
  s.box([1.9, 0.34, -1.0], [3.2, 0.4, -0.2])
  for (const [lx, lz] of [[2.0, -0.9], [3.1, -0.9], [3.1, -0.3], [2.0, -0.3]] as const) {
    s.line([lx, 0.34, lz], [lx, 0, lz], 0.8, false)
  }
  s.hatchFloor(1.95, 3.15, -0.95, -0.25, 0.08, 0.22)
  s.box([3.3, 0.32, 0.05], [4.0, 0.42, 0.75])
  s.box([3.3, 0.42, 0.66], [4.0, 0.92, 0.75])
  for (const [lx, lz] of [[3.33, 0.08], [3.97, 0.08], [3.97, 0.72], [3.33, 0.72]] as const) {
    s.line([lx, 0.32, lz], [lx + (lx < 3.6 ? -0.04 : 0.04), 0, lz + (lz < 0.4 ? -0.05 : 0.05)], 0.8, false)
  }

  // A plant by the window.
  s.box([3.85, 0, -2.75], [4.25, 0.42, -2.35])
  const stems: Array<[number, number, number]> = [
    [0.0, 1.35, 0.0], [-0.22, 1.12, 0.1], [0.24, 1.2, -0.08], [0.1, 0.98, 0.22], [-0.14, 1.28, -0.2],
  ]
  for (const [ox, top, oz] of stems) {
    const base: V3 = [4.05, 0.42, -2.55]
    const mid: V3 = [4.05 + ox * 0.5, (0.42 + top) / 2, -2.55 + oz * 0.5]
    const tip: V3 = [4.05 + ox, top, -2.55 + oz]
    s.path([base, mid, tip], 0.6, false)
    s.path([[mid[0] - 0.08, mid[1] + 0.1, mid[2]], mid, [mid[0] + 0.07, mid[1] + 0.12, mid[2] + 0.02]], 0.5, false)
    s.path([[tip[0] - 0.09, tip[1] - 0.05, tip[2]], tip, [tip[0] + 0.08, tip[1] - 0.04, tip[2]]], 0.5, false)
  }

  return s.build({
    gallery: new THREE.Vector3(-1.55, 1.15, -1.3),
    about: new THREE.Vector3(X0 + 0.05, 1.5, -1.98),
    contact: new THREE.Vector3(3.15, 0.42, -0.25),
  })
}

/*
 * One "boil" frame: every stroke re-drawn with its own small wobble and an
 * architect's overshoot past the corners. Several frames cycled quickly give
 * the hand-drawn shimmer. Returns flat position and colour arrays for
 * LineSegmentsGeometry (two passes for `double` strokes).
 */
export function boilFrame(strokes: Stroke[], seed: number) {
  const rnd = seeded(seed)
  const pos: number[] = []
  const col: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const ink = new THREE.Color()
  const wobble = () => (rnd() - 0.5) * 0.022

  const push = (tone: number, scale: number) => {
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
    // ink on paper: tone 1 = near-black, tone 0 = paper (sRGB, stored linear)
    const g = 0.95 - tone * 0.87
    ink.setRGB(g, g, g * 0.98, THREE.SRGBColorSpace)
    col.push(ink.r, ink.g, ink.b, ink.r, ink.g, ink.b)
  }

  for (const s of strokes) {
    a.set(...s.a)
    b.set(...s.b)
    push(s.tone, 1)
    if (s.double) push(s.tone * 0.55, 1.6)
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col) }
}
