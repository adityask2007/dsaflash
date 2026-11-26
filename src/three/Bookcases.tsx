import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { BOOKS, coverColor, hashId } from '../lib/catalog'
import { BOARD_T, BOARD_Y0, CASES, CASE_D, CASE_H, CASE_W, SHELF_PITCH, SHELVES, SHELVING, bookRotY, bookWorldPosition, type CaseFace } from '../lib/layout'
import { useLibrary } from '../store'
import { Box, mats } from './kit'
import { makeLabelTexture } from './textures'

function Case({ face }: { face: CaseFace }) {
  const M = mats()
  const goTo = useLibrary((s) => s.goTo)
  const [hover, setHover] = useState(false)
  const label = useMemo(
    () => makeLabelTexture(`SHELF ${face.index + 1}`, { w: 512, h: 128, sub: face.label, bg: '#2a190d', fg: '#ebcb82', border: '#c9a24d' }),
    [face],
  )
  const boards: number[] = []
  for (let s = 0; s <= SHELVES; s++) boards.push(BOARD_Y0 + s * SHELF_PITCH)

  return (
    <group position={[face.cx, 0, face.cz]} rotation={[0, face.rotY, 0]}>
      {/* carcass */}
      <Box p={[0, CASE_H / 2, 0.02]} s={[CASE_W, CASE_H, 0.04]} m={M.dark} cast={false} />
      <Box p={[-CASE_W / 2 + 0.03, CASE_H / 2, CASE_D / 2]} s={[0.07, CASE_H, CASE_D]} m={M.walnut} />
      <Box p={[CASE_W / 2 - 0.03, CASE_H / 2, CASE_D / 2]} s={[0.07, CASE_H, CASE_D]} m={M.walnut} />
      {boards.map((y, i) => (
        <Box key={i} p={[0, y, CASE_D / 2]} s={[CASE_W - 0.05, BOARD_T, CASE_D - 0.02]} m={M.walnut} cast={false} />
      ))}
      <Box p={[0, 0.07, CASE_D / 2 + 0.02]} s={[CASE_W + 0.06, 0.14, CASE_D + 0.04]} m={M.dark} />
      <Box p={[0, CASE_H + 0.05, CASE_D / 2 + 0.04]} s={[CASE_W + 0.14, 0.16, CASE_D + 0.1]} m={M.dark} cast={false} />
      <Box p={[0, CASE_H + 0.17, CASE_D / 2 + 0.02]} s={[CASE_W + 0.04, 0.1, CASE_D + 0.04]} m={M.walnut} cast={false} />
      {/* brass-framed plaque */}
      <Box p={[0, CASE_H + 0.58, 0.26]} s={[1.6, 0.34, 0.04]} m={M.brass} cast={false} />
      <mesh position={[0, CASE_H + 0.58, 0.285]}>
        <planeGeometry args={[1.5, 0.28]} />
        <meshStandardMaterial map={label} roughness={0.6} />
      </mesh>
      {/* click target for the whole shelf face */}
      <mesh
        position={[0, CASE_H / 2, CASE_D + 0.03]}
        onClick={(e) => {
          if (e.delta > 6) return
          e.stopPropagation()
          goTo(`case-${face.index}`)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
      >
        <planeGeometry args={[CASE_W, CASE_H]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={hover ? 0.1 : 0} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function CaseFrames() {
  return (
    <group>
      {CASES.map((f) => (
        <Case key={f.index} face={f} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ books ---- */

const dummy = new THREE.Object3D()
const tmpColor = new THREE.Color()
const LABEL_TINTS = ['#e8dcc0', '#d9c9a2', '#efe6d0', '#cdbb94']

function gatedRaycast(this: THREE.InstancedMesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
  if (!useLibrary.getState().nearShelves) return
  THREE.InstancedMesh.prototype.raycast.call(this, raycaster, intersects)
}

export function InstancedBooks() {
  const body = useRef<THREE.InstancedMesh>(null)
  const band = useRef<THREE.InstancedMesh>(null)
  const label = useRef<THREE.InstancedMesh>(null)
  const hidden = useRef<number | null>(null)
  const deskBookId = useLibrary((s) => s.deskBookId)
  const openDetail = useLibrary((s) => s.openDetail)
  const setHover = useLibrary((s) => s.setHoverBook)

  const writeOne = (id: number, hide: boolean) => {
    const b = body.current
    const g = band.current
    const l = label.current
    if (!b || !g || !l) return
    const { px, py, pz, bw, bh, bd } = SHELVING
    const rot = bookRotY(id)
    const c = Math.cos(rot)
    const s = Math.sin(rot)
    const place = (mesh: THREE.InstancedMesh, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number) => {
      dummy.position.set(px[id] + lx * c + lz * s, py[id] + ly, pz[id] - lx * s + lz * c)
      dummy.rotation.set(0, rot, 0)
      if (hide) dummy.scale.set(0, 0, 0)
      else dummy.scale.set(sx, sy, sz)
      dummy.updateMatrix()
      mesh.setMatrixAt(id, dummy.matrix)
    }
    place(b, 0, 0, 0, bw[id], bh[id], bd[id])
    place(g, 0, bh[id] * 0.3, bd[id] / 2 + 0.0015, bw[id] * 1.04, 0.014, 0.004)
    place(l, 0, -bh[id] * 0.04, bd[id] / 2 + 0.0015, bw[id] * 0.78, bh[id] * 0.26, 0.004)
  }

  useLayoutEffect(() => {
    const b = body.current
    const g = band.current
    const l = label.current
    if (!b || !g || !l) return
    for (let id = 0; id < BOOKS.length; id++) {
      writeOne(id, false)
      b.setColorAt(id, tmpColor.set(coverColor(id)))
      l.setColorAt(id, tmpColor.set(LABEL_TINTS[hashId(id, 5) % LABEL_TINTS.length]))
    }
    b.instanceMatrix.needsUpdate = g.instanceMatrix.needsUpdate = l.instanceMatrix.needsUpdate = true
    if (b.instanceColor) b.instanceColor.needsUpdate = true
    if (l.instanceColor) l.instanceColor.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // leave a gap on the shelf while the book is on the librarian's desk
  useLayoutEffect(() => {
    const prev = hidden.current
    if (prev !== null && prev !== deskBookId) writeOne(prev, false)
    if (deskBookId !== null) writeOne(deskBookId, true)
    hidden.current = deskBookId
    for (const m of [body.current, band.current, label.current]) if (m) m.instanceMatrix.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deskBookId])

  const raycast = gatedRaycast as unknown as THREE.Object3D['raycast']
  const hit = (e: ThreeEvent<PointerEvent | MouseEvent>) => (typeof e.instanceId === 'number' ? e.instanceId : null)

  return (
    <group>
      <instancedMesh
        ref={body}
        args={[undefined, undefined, BOOKS.length]}
        frustumCulled={false}
        receiveShadow
        raycast={raycast}
        onPointerMove={(e) => {
          const id = hit(e)
          if (id !== null) {
            e.stopPropagation()
            setHover(id)
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={() => {
          setHover(null)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          const id = hit(e)
          if (id === null || e.delta > 6) return
          e.stopPropagation()
          openDetail(id)
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.72} metalness={0.02} />
      </instancedMesh>
      <instancedMesh ref={band} args={[undefined, undefined, BOOKS.length]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d3aa56" metalness={0.8} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={label} args={[undefined, undefined, BOOKS.length]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
    </group>
  )
}

/* -------------------------------------------------- highlight / hover marker -- */

export function ShelfHighlight() {
  const highlightId = useLibrary((s) => s.highlightId)
  const hoverId = useLibrary((s) => s.hoverBookId)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const beam = useRef<THREE.MeshBasicMaterial>(null)
  const id = highlightId ?? hoverId
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (mat.current) mat.current.opacity = (highlightId !== null ? 0.5 : 0.28) + Math.sin(t * 5) * 0.12
    if (beam.current) beam.current.opacity = 0.14 + Math.sin(t * 3) * 0.05
  })
  if (id === null) return null
  const [x, y, z] = bookWorldPosition(id)
  const rot = bookRotY(id)
  const w = SHELVING.bw[id] + 0.03
  const h = SHELVING.bh[id] + 0.03
  const d = SHELVING.bd[id] + 0.03
  return (
    <group>
      <group position={[x, y, z]} rotation={[0, rot, 0]}>
        <mesh renderOrder={6}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial ref={mat} color="#ffd36a" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0, d / 2 + 0.35]} color="#ffcf70" intensity={highlightId !== null ? 4 : 1.2} distance={3} />
      </group>
      {highlightId !== null && (
        <mesh position={[x, (y + 7.6) / 2, z]}>
          <cylinderGeometry args={[0.035, 0.035, 7.6 - y, 8, 1, true]} />
          <meshBasicMaterial ref={beam} color="#ffd36a" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
