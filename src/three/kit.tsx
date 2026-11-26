import * as THREE from 'three'
import type { ThreeElements } from '@react-three/fiber'
import { makeFloorTexture, makePlasterTexture, makeWoodTexture } from './textures'

export type V3 = [number, number, number]

/* ------------------------------------------------------------ shared materials -- */

let cache: ReturnType<typeof build> | null = null
function build() {
  const walnutMap = makeWoodTexture('#4b2c18', 11)
  const oakMap = makeWoodTexture('#8d5d36', 21)
  const darkMap = makeWoodTexture('#2f1b0f', 31, 40)
  const floorMap = makeFloorTexture()
  const plasterMap = makePlasterTexture()
  return {
    walnut: new THREE.MeshStandardMaterial({ map: walnutMap, color: '#ffffff', roughness: 0.55, metalness: 0.04 }),
    oak: new THREE.MeshStandardMaterial({ map: oakMap, roughness: 0.5, metalness: 0.03 }),
    dark: new THREE.MeshStandardMaterial({ map: darkMap, roughness: 0.6, metalness: 0.03 }),
    floor: new THREE.MeshPhysicalMaterial({ map: floorMap, roughness: 0.42, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterMap, roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#3b2415', roughness: 0.8 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a24d', metalness: 0.9, roughness: 0.28 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e0b95e', metalness: 0.85, roughness: 0.35 }),
    iron: new THREE.MeshStandardMaterial({ color: '#2b2b2e', metalness: 0.7, roughness: 0.45 }),
    leather: new THREE.MeshStandardMaterial({ color: '#5a1f1a', roughness: 0.55, metalness: 0.02 }),
    leatherGreen: new THREE.MeshStandardMaterial({ color: '#1f4a36', roughness: 0.55 }),
    fabric: new THREE.MeshStandardMaterial({ color: '#6b2d2d', roughness: 0.95 }),
    paper: new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.9 }),
    glassWarm: new THREE.MeshBasicMaterial({ color: '#ffe9b8', toneMapped: false }),
    lampGlass: new THREE.MeshStandardMaterial({ color: '#1f6b4a', emissive: '#2fa070', emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffe2a6', toneMapped: false }),
    stone: new THREE.MeshStandardMaterial({ color: '#8c8478', roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#2f6a3a', roughness: 0.8 }),
    pot: new THREE.MeshStandardMaterial({ color: '#8f4f33', roughness: 0.8 }),
  }
}
export function mats() {
  if (!cache) cache = build()
  return cache
}

/* -------------------------------------------------------------- mesh helpers -- */

type MeshProps = Omit<ThreeElements['mesh'], 'position' | 'rotation' | 'scale' | 'material' | 'geometry'>

export function Box({ p = [0, 0, 0], s = [1, 1, 1], r, m, cast = true, receive = true, ...rest }: { p?: V3; s?: V3; r?: V3; m: THREE.Material; cast?: boolean; receive?: boolean } & MeshProps) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow={cast} receiveShadow={receive} {...rest}>
      <boxGeometry args={s} />
    </mesh>
  )
}

/** cylinder: radii top/bottom + height */
export function Cyl({ p = [0, 0, 0], d, r, seg = 24, m, cast = true, receive = true, ...rest }: { p?: V3; d: [number, number, number]; r?: V3; seg?: number; m: THREE.Material; cast?: boolean; receive?: boolean } & MeshProps) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow={cast} receiveShadow={receive} {...rest}>
      <cylinderGeometry args={[d[0], d[1], d[2], seg]} />
    </mesh>
  )
}

export function Ball({ p = [0, 0, 0], rad = 0.1, sc, m, cast = false, seg = 20, ...rest }: { p?: V3; rad?: number; sc?: V3; m: THREE.Material; cast?: boolean; seg?: number } & MeshProps) {
  return (
    <mesh position={p} scale={sc} material={m} castShadow={cast} {...rest}>
      <sphereGeometry args={[rad, seg, Math.max(8, seg - 6)]} />
    </mesh>
  )
}
