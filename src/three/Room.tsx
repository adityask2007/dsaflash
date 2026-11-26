import { useMemo } from 'react'
import * as THREE from 'three'
import { Sparkles } from '@react-three/drei'
import { ROOM } from '../lib/layout'
import type { Quality } from '../lib/storage'
import { Ball, Box, Cyl, mats, type V3 } from './kit'
import { makeBeamTexture, makeRugTexture, makeSkyTexture } from './textures'

const W = ROOM.x1 - ROOM.x0
const D = ROOM.z1 - ROOM.z0
const CX = (ROOM.x0 + ROOM.x1) / 2
const CZ = (ROOM.z0 + ROOM.z1) / 2

function WindowUnit({ p, rotY, w, h, glass }: { p: V3; rotY: number; w: number; h: number; glass: THREE.Material }) {
  const M = mats()
  const t = 0.14
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <mesh material={glass}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <Box p={[0, h / 2, 0.05]} s={[w + 0.3, t, 0.14]} m={M.dark} />
      <Box p={[0, -h / 2, 0.05]} s={[w + 0.3, t, 0.14]} m={M.dark} />
      <Box p={[-w / 2, 0, 0.05]} s={[t, h, 0.14]} m={M.dark} />
      <Box p={[w / 2, 0, 0.05]} s={[t, h, 0.14]} m={M.dark} />
      <Box p={[0, 0, 0.05]} s={[0.07, h, 0.08]} m={M.dark} />
      <Box p={[0, h * 0.18, 0.05]} s={[w, 0.07, 0.08]} m={M.dark} />
      <Box p={[0, -h * 0.2, 0.05]} s={[w, 0.07, 0.08]} m={M.dark} />
      <Box p={[0, -h / 2 - 0.08, 0.2]} s={[w + 0.5, 0.1, 0.34]} m={M.oak} />
    </group>
  )
}

/** two crossed translucent quads = a volumetric-looking sun shaft */
function Shaft({ top, bottom, width, mat }: { top: V3; bottom: V3; width: number; mat: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...top)
    const b = new THREE.Vector3(...bottom)
    const dir = a.clone().sub(b)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return { pos: a.clone().add(b).multiplyScalar(0.5).toArray() as V3, quat, len }
  }, [top, bottom])
  return (
    <group position={pos} quaternion={quat}>
      <mesh material={mat} renderOrder={5}>
        <planeGeometry args={[width, len]} />
      </mesh>
      <mesh material={mat} rotation={[0, Math.PI / 2, 0]} renderOrder={5}>
        <planeGeometry args={[width, len]} />
      </mesh>
    </group>
  )
}

function Chandelier({ p, light }: { p: V3; light: boolean }) {
  const M = mats()
  const bulbs: V3[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    bulbs.push([Math.cos(a) * 0.75, 0.13, Math.sin(a) * 0.75])
  }
  return (
    <group position={p}>
      <Cyl p={[0, 1.2, 0]} d={[0.012, 0.012, 2.4]} m={M.iron} seg={6} cast={false} />
      <Ball p={[0, -0.05, 0]} rad={0.14} m={M.brass} />
      <mesh material={M.brass} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.03, 8, 40]} />
      </mesh>
      <mesh material={M.brass} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <torusGeometry args={[0.38, 0.025, 8, 28]} />
      </mesh>
      {bulbs.map((b, i) => (
        <group key={i} position={b}>
          <Cyl p={[0, -0.04, 0]} d={[0.03, 0.03, 0.1]} m={M.brass} seg={8} cast={false} />
          <Ball p={[0, 0.06, 0]} rad={0.045} m={M.bulb} seg={10} />
        </group>
      ))}
      {light && <pointLight position={[0, -0.4, 0]} intensity={52} distance={19} decay={2} color="#ffcf8f" />}
    </group>
  )
}

export function Room({ quality }: { quality: Quality }) {
  const M = mats()
  const sky = useMemo(() => new THREE.MeshBasicMaterial({ map: makeSkyTexture(), toneMapped: false, fog: false }), [])
  const rugTex = useMemo(() => makeRugTexture(), [])
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: makeBeamTexture(),
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      }),
    [],
  )
  const dust = quality === 'low' ? 70 : quality === 'medium' ? 180 : 320

  const sideZ: number[] = []
  for (let i = 0; i < 6; i++) sideZ.push(-7 + i * 3.2)

  return (
    <group>
      {/* floor + rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0, CZ]} material={M.floor} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -1]} receiveShadow>
        <planeGeometry args={[6.2, 9.3]} />
        <meshStandardMaterial map={rugTex} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, -9.2]} receiveShadow>
        <planeGeometry args={[5.4, 2.2]} />
        <meshStandardMaterial map={rugTex} roughness={0.95} color="#d8c8b8" />
      </mesh>

      {/* ceiling + beams */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[CX, ROOM.h, CZ]} material={M.ceiling}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {[-14, -10, -6, -2, 2, 6, 10].map((z) => (
        <Box key={z} p={[0, ROOM.h - 0.2, z]} s={[W, 0.38, 0.42]} m={M.dark} cast={false} />
      ))}
      <Box p={[-6, ROOM.h - 0.12, CZ]} s={[0.36, 0.26, D]} m={M.dark} cast={false} />
      <Box p={[6, ROOM.h - 0.12, CZ]} s={[0.36, 0.26, D]} m={M.dark} cast={false} />

      {/* walls */}
      <mesh position={[0, ROOM.h / 2, ROOM.z0]} material={M.plaster} receiveShadow>
        <planeGeometry args={[W, ROOM.h]} />
      </mesh>
      <mesh position={[0, ROOM.h / 2, ROOM.z1]} rotation={[0, Math.PI, 0]} material={M.plaster} receiveShadow>
        <planeGeometry args={[W, ROOM.h]} />
      </mesh>
      <mesh position={[ROOM.x0, ROOM.h / 2, CZ]} rotation={[0, Math.PI / 2, 0]} material={M.plaster} receiveShadow>
        <planeGeometry args={[D, ROOM.h]} />
      </mesh>
      <mesh position={[ROOM.x1, ROOM.h / 2, CZ]} rotation={[0, -Math.PI / 2, 0]} material={M.plaster} receiveShadow>
        <planeGeometry args={[D, ROOM.h]} />
      </mesh>
      {/* wainscot, skirting and crown moulding */}
      <Box p={[0, 0.7, ROOM.z0 + 0.07]} s={[W, 1.4, 0.14]} m={M.walnut} cast={false} />
      <Box p={[0, 1.42, ROOM.z0 + 0.1]} s={[W, 0.06, 0.2]} m={M.brass} cast={false} />
      <Box p={[0, 0.7, ROOM.z1 - 0.07]} s={[W, 1.4, 0.14]} m={M.walnut} cast={false} />
      <Box p={[0, 1.42, ROOM.z1 - 0.1]} s={[W, 0.06, 0.2]} m={M.brass} cast={false} />
      <Box p={[0, ROOM.h - 0.1, ROOM.z0 + 0.15]} s={[W, 0.22, 0.3]} m={M.dark} cast={false} />
      <Box p={[0, ROOM.h - 0.1, ROOM.z1 - 0.15]} s={[W, 0.22, 0.3]} m={M.dark} cast={false} />
      <Box p={[ROOM.x0 + 0.15, ROOM.h - 0.1, CZ]} s={[0.3, 0.22, D]} m={M.dark} cast={false} />
      <Box p={[ROOM.x1 - 0.15, ROOM.h - 0.1, CZ]} s={[0.3, 0.22, D]} m={M.dark} cast={false} />
      <Box p={[ROOM.x0 + 0.14, 4.45, CZ]} s={[0.28, 0.18, D]} m={M.walnut} cast={false} />
      <Box p={[ROOM.x1 - 0.14, 4.45, CZ]} s={[0.28, 0.18, D]} m={M.walnut} cast={false} />

      {/* grand windows (back wall) */}
      {[-7.5, 0, 7.5].map((x) => (
        <WindowUnit key={x} p={[x, 4.4, ROOM.z0 + 0.03]} rotY={0} w={2.9} h={5.6} glass={sky} />
      ))}
      {/* clerestory windows */}
      {sideZ.map((z) => (
        <WindowUnit key={`l${z}`} p={[ROOM.x0 + 0.03, 6.55, z]} rotY={Math.PI / 2} w={2.2} h={2.3} glass={sky} />
      ))}
      {sideZ.map((z) => (
        <WindowUnit key={`r${z}`} p={[ROOM.x1 - 0.03, 6.55, z]} rotY={-Math.PI / 2} w={2.2} h={2.3} glass={sky} />
      ))}

      {/* sun shafts */}
      {sideZ.map((z) => (
        <Shaft key={`sr${z}`} top={[ROOM.x1 - 0.3, 6.9, z]} bottom={[3.8, 0.05, z - 3.2]} width={1.7} mat={beamMat} />
      ))}
      {[-7.5, 0, 7.5].map((x) => (
        <Shaft key={`sb${x}`} top={[x, 6.6, ROOM.z0 + 0.4]} bottom={[x + 2.6, 0.05, ROOM.z0 + 8.4]} width={2.2} mat={beamMat} />
      ))}

      {/* entrance doors */}
      <group position={[0, 0, ROOM.z1 - 0.1]} rotation={[0, Math.PI, 0]}>
        <Box p={[0, 1.9, 0]} s={[3.1, 3.8, 0.16]} m={M.dark} cast={false} />
        <Box p={[-0.7, 1.7, 0.1]} s={[1.3, 3.2, 0.08]} m={M.walnut} cast={false} />
        <Box p={[0.7, 1.7, 0.1]} s={[1.3, 3.2, 0.08]} m={M.walnut} cast={false} />
        <Box p={[-0.15, 1.7, 0.18]} s={[0.04, 0.5, 0.05]} m={M.brass} cast={false} />
        <Box p={[0.15, 1.7, 0.18]} s={[0.04, 0.5, 0.05]} m={M.brass} cast={false} />
        <Box p={[0, 3.9, 0.02]} s={[3.5, 0.2, 0.22]} m={M.dark} cast={false} />
      </group>

      {/* chandeliers */}
      <Chandelier p={[0, 6.2, 6.5]} light />
      <Chandelier p={[0, 6.2, -1.5]} light />
      <Chandelier p={[0, 6.2, -9]} light={quality !== 'low'} />

      {/* ambient dust in the sun */}
      <Sparkles count={dust} scale={[21, 7, 26]} position={[0, 3.8, -2]} size={2.4} speed={0.18} opacity={0.5} color="#ffe6b0" noise={0.5} />
    </group>
  )
}
