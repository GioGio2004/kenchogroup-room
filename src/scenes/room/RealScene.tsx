import { ContactShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { FINISH, type RealMats } from '@/scenes/room/real-materials'
import { FILL_KEYS, KITCHEN_PARTS, ROOM, type FillKey, type Layer, type NotePart, type Zone } from '@/scenes/room/sketch'

/*
 * The realistic room: the same plan as the sketch, rendered with real
 * materials and light (see real-materials.ts). The light is a studio-like
 * environment for reflections, one soft-shadowed key light, and the warm
 * glow of the pendants, the under-cabinet strip and the workshop.
 */
const TV_ON = new THREE.Color('#43534a')
const HOVER = new THREE.Color('#ffffff')

interface RealLive {
  wash: number
  door: number
  mobile: boolean
  hot: Record<Zone, number>
  part: Record<NotePart, number>
}

function Lights() {
  const Z0 = -ROOM.d / 2
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8cfc2', 0.35]} />
      {/* the key light: daylight through the window, with soft shadows that fall into view */}
      <directionalLight
        position={[9, 7.5, -1.2]}
        intensity={2.5}
        color="#fff8ef"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0012}
        shadow-normalBias={0.05}
        shadow-radius={6}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      {/* a soft fill from the open front, so the fronts never go muddy */}
      <directionalLight position={[0, 4, 9]} intensity={0.55} color="#f4f1ec" />
      {/* warm pools: pendants, the under-cabinet strip, the arc lamp, the workshop */}
      {[-2.2, -1.55, -0.9].map((x) => (
        <pointLight key={x} position={[x, 1.58, -1.3]} intensity={1.6} distance={3.2} decay={2} color="#ffd6a3" />
      ))}
      <pointLight position={[-2.4, 1.36, Z0 + 0.32]} intensity={0.9} distance={1.8} decay={2} color="#fff0d6" />
      <pointLight position={[-1.0, 1.36, Z0 + 0.32]} intensity={0.9} distance={1.8} decay={2} color="#fff0d6" />
      <pointLight position={[3.45, 1.82, 0.3]} intensity={1.4} distance={3} decay={2} color="#ffd6a3" />
      <pointLight position={[0.9, 1.7, Z0 - 2.6]} intensity={4} distance={6} decay={2} color="#ffd39b" />
    </>
  )
}

/* A studio-like environment for reflections. */
function Studio() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.5
    // (the backdrop is the page behind a transparent canvas: a scene
    // background would also fill the contact-shadow pass)
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function Meshes({ layer, mats }: { layer: Layer; mats: RealMats }) {
  return (
    <>
      {(Object.entries(layer.fills) as Array<[FillKey, THREE.BufferGeometry]>).map(([key, g]) => (
        <mesh key={key} geometry={g} material={mats[key]} castShadow={FINISH[key].cast ?? true} receiveShadow={FINISH[key].receive ?? true} />
      ))}
    </>
  )
}

/*
 * The scene itself. Colours follow `targets` (the kitchen finish tweens
 * there); the lights come up with `wash` as the camera arrives.
 */
export function RealScene({
  main,
  leaf,
  hinge,
  mats,
  targets,
  live,
  door,
}: {
  main: Layer
  /** the workshop door's leaf, which swings around `hinge` */
  leaf: Layer
  hinge: [number, number, number]
  mats: RealMats
  targets: Record<FillKey, THREE.Color>
  live: MutableRefObject<RealLive>
  door: MutableRefObject<THREE.Group | null>
}) {
  const gl = useThree((s) => s.gl)
  const glowing = useMemo(() => FILL_KEYS.filter((k) => FINISH[k].glow), [])

  useFrame(() => {
    const L = live.current
    gl.toneMappingExposure = 0.08 + 0.92 * L.wash
    for (const key of FILL_KEYS) mats[key].color.copy(targets[key])
    for (const key of glowing) mats[key].emissive.copy(targets[key]).multiplyScalar(FINISH[key].glow!)
    // hover: the kitchen brightens a touch, the TV wakes up
    for (const part of KITCHEN_PARTS) {
      const lift = L.hot.kitchen * 0.05 + (part === 'shelf' ? 0 : L.part[part] * 0.09)
      mats[part].emissive.copy(HOVER).multiplyScalar(lift)
    }
    mats.tv.emissive.copy(TV_ON).multiplyScalar(L.hot.media)
    if (door.current) door.current.rotation.y = -Math.max(L.hot.door * 0.6, L.door * 1.6)
  })

  return (
    <>
      <Studio />
      <Lights />
      <Meshes layer={main} mats={mats} />
      {/* soft contact shadows ground everything that stands on the floor (drawn once: the room is still) */}
      <ContactShadows position={[0, 0.0135, 0]} scale={[9, 7]} resolution={1024} frames={1} far={1.4} blur={2.4} opacity={0.5} color="#2a2520" />
      <group ref={door} position={hinge}>
        <Meshes layer={leaf} mats={mats} />
      </group>
    </>
  )
}
