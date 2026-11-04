import * as THREE from 'three'
import { FILL_KEYS, type FillKey, type RoomKey } from '@/scenes/room/sketch'

/*
 * The realistic room's materials. Black and white with warm beige:
 * beige-white matte lacquer, black quartz, white walls, light oak
 * floorboards, black metal and leather. Every texture is drawn in code.
 */
export const REAL_COLORS: Record<RoomKey, string> = {
  wall: '#efece6',
  wallSide: '#ebe7e0',
  ceiling: '#f3f1ec',
  floor: '#d4bf9e',
  glass: '#eef3f6',
  curtain: '#ebe6dc',
  door: '#1d1c1b',
  frame: '#141414',
  shop: '#4c4137',
  shopSide: '#43392f',
  shopFloor: '#6a5a4a',
  peg: '#a78a6a',
  plinth: '#1c1b1a',
  appliance: '#0e0e0f',
  steel: '#c9ccce',
  media: '#e4ddd1',
  walnut: '#1b1a19',
  tv: '#0b0b0c',
  rug: '#e2ddd3',
  leather: '#1c1b1a',
  pot: '#ebe8e2',
  art1: '#151515',
  art2: '#e8e4dc',
  art3: '#8d8781',
  stool: '#1d1c1b',
  metal: '#161616',
  leaf: '#4f6b45',
  bulb: '#fff1d8',
  groove: '#2a2724',
  fruit: '#e2792b',
}

type Surface = 'wood' | 'stone' | 'weave'
interface Finish {
  roughness: number
  metalness?: number
  clearcoat?: number
  clearcoatRoughness?: number
  surface?: Surface
  repeat?: [number, number]
  /** glows by itself (the window, the bulbs) */
  glow?: number
  side?: THREE.Side
  /** casts shadows (walls and ceiling only receive them) */
  cast?: boolean
  /** receives shadows (glossy screens show acne at grazing light, so the TV doesn't) */
  receive?: boolean
}

export const FINISH: Record<FillKey, Finish> = {
  cabinets: { roughness: 0.5 },
  fronts: { roughness: 0.5 },
  worktop: { roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1, surface: 'stone', repeat: [4, 1] },
  tile: { roughness: 0.12, clearcoat: 0.5, clearcoatRoughness: 0.08 },
  shelf: { roughness: 0.62, surface: 'wood' },
  wall: { roughness: 0.95, cast: false },
  wallSide: { roughness: 0.95, cast: false },
  // a touch of glow stands in for the light a real ceiling gets bounced up at it
  ceiling: { roughness: 0.97, glow: 0.45, cast: false },
  floor: { roughness: 0.48, clearcoat: 0.18, clearcoatRoughness: 0.4, surface: 'wood', repeat: [6.5, 2.6], cast: false },
  glass: { roughness: 1, glow: 1.15, cast: false },
  curtain: { roughness: 1, surface: 'weave', repeat: [1, 6] },
  door: { roughness: 0.48 },
  frame: { roughness: 0.42 },
  shop: { roughness: 0.9, cast: false },
  shopSide: { roughness: 0.9, cast: false },
  shopFloor: { roughness: 0.85, cast: false },
  peg: { roughness: 0.8 },
  plinth: { roughness: 0.8 },
  appliance: { roughness: 0.08, metalness: 0.4 },
  steel: { roughness: 0.26, metalness: 1 },
  media: { roughness: 0.6 },
  walnut: { roughness: 0.42 },
  tv: { roughness: 0.22, metalness: 0.2, receive: false },
  rug: { roughness: 1, surface: 'weave', repeat: [5, 6], cast: false },
  leather: { roughness: 0.36, clearcoat: 0.25, clearcoatRoughness: 0.4 },
  pot: { roughness: 0.32 },
  art1: { roughness: 0.7 },
  art2: { roughness: 0.7 },
  art3: { roughness: 0.7 },
  stool: { roughness: 0.36, clearcoat: 0.25, clearcoatRoughness: 0.4 },
  metal: { roughness: 0.32, metalness: 0.75, side: THREE.DoubleSide },
  leaf: { roughness: 0.6 },
  bulb: { roughness: 1, glow: 3.2, cast: false },
  groove: { roughness: 0.9, cast: false },
  fruit: { roughness: 0.55 },
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* Greyscale surfaces (near white) that the material's colour tints. */
function surface(kind: Surface) {
  const size = kind === 'wood' ? 1024 : 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const rnd = seeded(kind.length * 977)
  if (kind === 'wood') {
    // eight boards across, each with its own tone, long grain and a joint
    const boards = 8
    const bw = size / boards
    for (let b = 0; b < boards; b++) {
      const tone = 205 + rnd() * 40
      g.fillStyle = `rgb(${tone},${tone},${tone})`
      g.fillRect(b * bw, 0, bw, size)
      for (let k = 0; k < 46; k++) {
        const x = b * bw + rnd() * bw
        const w = 0.6 + rnd() * 1.8
        g.strokeStyle = `rgba(90,90,90,${0.05 + rnd() * 0.12})`
        g.lineWidth = w
        g.beginPath()
        for (let y = 0; y <= size; y += 16) g.lineTo(x + Math.sin(y * 0.01 + k) * (2 + rnd() * 2), y)
        g.stroke()
      }
      g.fillStyle = 'rgba(60,60,60,0.55)'
      g.fillRect(b * bw, 0, 1.5, size)
      const joint = rnd() * size
      g.fillRect(b * bw, joint, bw, 1.5)
    }
  } else if (kind === 'stone') {
    g.fillStyle = 'rgb(236,236,236)'
    g.fillRect(0, 0, size, size)
    for (let k = 0; k < 2600; k++) {
      const v = 180 + rnd() * 75
      g.fillStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.5})`
      g.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 1.6, 1 + rnd() * 1.6)
    }
  } else {
    g.fillStyle = 'rgb(240,240,240)'
    g.fillRect(0, 0, size, size)
    for (let y = 0; y < size; y += 3) {
      for (let x = 0; x < size; x += 3) {
        const v = 215 + rnd() * 40
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(x, y, 3, 3)
      }
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  return tex
}

export type RealMats = Record<FillKey, THREE.MeshPhysicalMaterial>

export function makeRealMaterials() {
  const textures: Partial<Record<Surface, THREE.CanvasTexture>> = {}
  const m = {} as RealMats
  for (const key of FILL_KEYS) {
    const f = FINISH[key]
    let map: THREE.Texture | null = null
    if (f.surface) {
      const base = (textures[f.surface] ??= surface(f.surface))
      map = base.clone()
      map.repeat.set(...(f.repeat ?? [1, 1]))
      map.needsUpdate = true
    }
    m[key] = new THREE.MeshPhysicalMaterial({
      roughness: f.roughness,
      metalness: f.metalness ?? 0,
      clearcoat: f.clearcoat ?? 0,
      clearcoatRoughness: f.clearcoatRoughness ?? 0,
      map,
      side: f.side ?? THREE.FrontSide,
    })
  }
  return m
}
