import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { LIBRARIAN_POS } from '../lib/layout'
import { useLibrary } from '../store'
import { CaseFrames, InstancedBooks, ShelfHighlight } from './Bookcases'
import { DeskBook } from './DeskBook'
import { Furniture } from './Furniture'
import { Librarian } from './Librarian'
import { Player } from './Player'
import { Room } from './Room'

function Lights({ shadows, mapSize }: { shadows: boolean; mapSize: number }) {
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0, -2)
    return o
  }, [])
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 1.5, LIBRARIAN_POS[2])
    return o
  }, [])
  return (
    <>
      <ambientLight intensity={0.5} color="#ffe6c4" />
      <hemisphereLight args={['#fff1d6', '#5a3b22', 0.7]} />
      <primitive object={target} />
      <primitive object={spotTarget} />
      <directionalLight
        position={[11, 15, -5]}
        target={target}
        intensity={2.4}
        color="#ffd9a0"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-17}
        shadow-camera-right={17}
        shadow-camera-top={17}
        shadow-camera-bottom={-17}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <spotLight position={[0, 5.6, -5.2]} target={spotTarget} angle={0.5} penumbra={0.85} intensity={95} distance={14} decay={2} color="#ffe2b8" />
      <pointLight position={[0, 2.4, -14]} intensity={14} distance={9} decay={2} color="#ffd6a0" />
    </>
  )
}

export default function Scene() {
  const quality = useLibrary((s) => s.prefs.quality)
  const shadows = quality !== 'low'
  const dpr: [number, number] = quality === 'low' ? [1, 1] : quality === 'medium' ? [1, 1.5] : [1, 2]
  return (
    <Canvas
      shadows={shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={dpr}
      camera={{ fov: 62, near: 0.1, far: 90, position: [0, 2.7, 9] }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      onCreated={({ gl }) => {
        gl.setClearColor('#120b06')
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <fog attach="fog" args={['#2a1a0e', 22, 62]} />
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={3} color="#ffe2b0" position={[0, 6, -15]} scale={[14, 5, 1]} />
          <Lightformer form="rect" intensity={2.2} color="#ffd9a0" position={[14, 6, -2]} rotation-y={-Math.PI / 2} scale={[20, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#c9d8ff" position={[-14, 6, -2]} rotation-y={Math.PI / 2} scale={[20, 3, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#ffcf90" position={[0, 9, -2]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        </Environment>
      </Suspense>
      <Lights shadows={shadows} mapSize={quality === 'high' ? 4096 : 2048} />
      <Room quality={quality} />
      <CaseFrames />
      <InstancedBooks />
      <ShelfHighlight />
      <Furniture quality={quality} />
      <Librarian />
      <DeskBook />
      <Player />
    </Canvas>
  )
}
