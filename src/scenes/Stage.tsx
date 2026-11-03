import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { useFrame } from '@react-three/fiber'

/* Placeholder WebGL stage: proves the canvas, renderer and frame loop work.
 * The real room (video stations + front-recolour shader) replaces this. */
function Swatch() {
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.25
  })
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[1.6, 2.2, 0.08]} />
      <meshStandardMaterial color="#b39359" roughness={0.45} metalness={0.2} />
    </mesh>
  )
}

export default function Stage() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4], fov: 40 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} />
      <Swatch />
    </Canvas>
  )
}
