import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { BOOKS, coverColor, coverInk, titleCase } from '../lib/catalog'
import { CASES, DESK_SPOT, SHELVING, bookRotY, bookWorldPosition } from '../lib/layout'
import { useLibrary } from '../store'
import { mats } from './kit'
import { makeLabelTexture } from './textures'

/* The requested book leaves its shelf, glides across the room on an arc and lands on
 * the librarian's brass stand. "Return to shelf" plays the same path backwards. */

const DISPLAY = { w: 0.27, h: 0.37, t: 0.07, tilt: -0.5 }
const IN_TIME = 3.1
const OUT_TIME = 2.6

const ease = (x: number) => x * x * (3 - 2 * x)
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)

const _p0 = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _c = new THREE.Vector3()
const _d = new THREE.Vector3()

export function DeskBook() {
  const deskBookId = useLibrary((s) => s.deskBookId)
  const deliverNonce = useLibrary((s) => s.deliverNonce)
  const returnNonce = useLibrary((s) => s.returnNonce)
  const openDetail = useLibrary((s) => s.openDetail)

  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const S = useRef({ phase: 'idle' as 'idle' | 'in' | 'rest' | 'out', t0: 0, id: -1, nonceD: -1, nonceR: -1 })

  const M = mats()
  const materials = useMemo(() => {
    if (deskBookId === null) return null
    const color = coverColor(deskBookId)
    const front = makeLabelTexture(titleCase(BOOKS[deskBookId].title), { w: 256, h: 352, bg: color, fg: coverInk(deskBookId), border: coverInk(deskBookId), sub: `No. ${deskBookId}`, font: '700 54px Georgia, serif', subFont: '400 26px Georgia, serif' })
    const cover = new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    const faces = [M.paper, cover, M.paper, M.paper, new THREE.MeshStandardMaterial({ map: front, roughness: 0.55 }), cover]
    return faces
  }, [deskBookId, M])

  useEffect(() => {
    const s = S.current
    const now = performance.now() / 1000
    if (deliverNonce !== s.nonceD) {
      s.nonceD = deliverNonce
      if (deskBookId !== null) {
        s.id = deskBookId
        s.phase = 'in'
        s.t0 = now
      }
    }
  }, [deliverNonce, deskBookId])

  useEffect(() => {
    const s = S.current
    if (returnNonce !== s.nonceR) {
      s.nonceR = returnNonce
      if (s.phase === 'rest' || s.phase === 'in') {
        s.phase = 'out'
        s.t0 = performance.now() / 1000
      }
    }
  }, [returnNonce])

  useFrame(({ clock }) => {
    const s = S.current
    const g = group.current
    const m = mesh.current
    if (!g || !m) return
    if (s.phase === 'idle' || s.id < 0) {
      g.visible = false
      return
    }
    g.visible = true
    const now = performance.now() / 1000
    const id = s.id
    const face = CASES[SHELVING.caseOf[id]]
    const [sx, sy, sz] = bookWorldPosition(id)
    const yaw0 = bookRotY(id) + Math.PI / 2
    let dyaw = ((0 - yaw0 + Math.PI) % (Math.PI * 2)) - Math.PI
    if (dyaw < -Math.PI) dyaw += Math.PI * 2

    _p0.set(sx, sy, sz)
    _p1.set(sx + face.nx * 0.45, sy, sz)
    const deskY = DESK_SPOT[1] + 0.2 + Math.sin(clock.elapsedTime * 1.5) * 0.012
    _d.set(DESK_SPOT[0], deskY, DESK_SPOT[2])
    _c.set((_p1.x + _d.x) / 2, Math.max(_p1.y, _d.y) + 1.7, (_p1.z + _d.z) / 2)

    // progress: 0 = on the shelf, 1 = on the desk
    let prog = 1
    if (s.phase === 'in') {
      prog = Math.min(1, (now - s.t0) / IN_TIME)
      if (prog >= 1) s.phase = 'rest'
    } else if (s.phase === 'out') {
      const q = Math.min(1, (now - s.t0) / OUT_TIME)
      prog = 1 - q
      if (q >= 1) {
        s.phase = 'idle'
        s.id = -1
        g.visible = false
        useLibrary.getState().clearDeskBook()
        return
      }
    }

    const pos = g.position
    let dims = { w: SHELVING.bd[id], h: SHELVING.bh[id], t: SHELVING.bw[id] }
    let yaw = yaw0
    let tilt = 0
    let roll = 0
    if (prog < 0.18) {
      const k = easeOut(prog / 0.18)
      pos.lerpVectors(_p0, _p1, k)
    } else if (prog < 0.88) {
      const k = (prog - 0.18) / 0.7
      const e = ease(k)
      const a = 1 - e
      pos.set(a * a * _p1.x + 2 * a * e * _c.x + e * e * _d.x, a * a * _p1.y + 2 * a * e * _c.y + e * e * _d.y, a * a * _p1.z + 2 * a * e * _c.z + e * e * _d.z)
      yaw = yaw0 + dyaw * e
      tilt = DISPLAY.tilt * e
      roll = Math.sin(Math.PI * e) * 0.5
      dims = {
        w: THREE.MathUtils.lerp(dims.w, DISPLAY.w, e),
        h: THREE.MathUtils.lerp(dims.h, DISPLAY.h, e),
        t: THREE.MathUtils.lerp(dims.t, DISPLAY.t, e),
      }
    } else {
      const k = (prog - 0.88) / 0.12
      pos.copy(_d)
      pos.y += (1 - ease(k)) * 0.06
      yaw = yaw0 + dyaw
      tilt = DISPLAY.tilt
      dims = { w: DISPLAY.w, h: DISPLAY.h, t: DISPLAY.t }
    }
    g.rotation.set(tilt, yaw, roll, 'YXZ')
    m.scale.set(dims.w, dims.h, dims.t)
    const resting = s.phase === 'rest'
    if (light.current) light.current.intensity = resting ? 1.6 + Math.sin(clock.elapsedTime * 2) * 0.4 : 2.6
    if (ring.current) {
      ring.current.visible = resting
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 + Math.sin(clock.elapsedTime * 2.4) * 0.15
    }
  })

  return (
    <>
      <group ref={group} visible={false}>
        {materials && (
          <mesh
            ref={mesh}
            material={materials}
            castShadow
            onClick={(e) => {
              if (e.delta > 6 || S.current.id < 0) return
              e.stopPropagation()
              openDetail(S.current.id)
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        )}
        {!materials && (
          <mesh ref={mesh}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        )}
        <pointLight ref={light} color="#ffd27a" intensity={2} distance={3.2} decay={2} position={[0, 0.1, 0.4]} />
        {deskBookId !== null && <Sparkles count={14} scale={[0.6, 0.6, 0.4]} size={2.2} speed={0.5} opacity={0.8} color="#ffdc8a" />}
      </group>
      <mesh ref={ring} position={[DESK_SPOT[0], DESK_SPOT[1] + 0.005, DESK_SPOT[2] + 0.03]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.2, 0.26, 40]} />
        <meshBasicMaterial color="#ffd27a" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  )
}
