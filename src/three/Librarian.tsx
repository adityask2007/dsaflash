import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { LIBRARIAN_POS } from '../lib/layout'
import type { Gesture, Mood } from '../lib/librarian'
import { useLibrary } from '../store'

/* ============================================================================
 *  Elara Quill – the virtual librarian.
 *  A fully procedural character (no model files): articulated arms and hands,
 *  blinking eyes with gaze, expressive brows and mouth, speech animation and
 *  gestures (wave / present / shrug / think / point) driven by the store.
 * ========================================================================== */

const damp = THREE.MathUtils.damp

interface MoodTarget {
  smile: number
  raise: number
  innerUp: number
  wide: number
  asym: number
}
const MOODS: Record<Mood, MoodTarget> = {
  happy: { smile: 0.8, raise: 0, innerUp: 0, wide: 1, asym: 0 },
  excited: { smile: 1.2, raise: 0.016, innerUp: -0.05, wide: 1.12, asym: 0 },
  thinking: { smile: 0.1, raise: 0.006, innerUp: -0.12, wide: 0.96, asym: 0.014 },
  sorry: { smile: -0.35, raise: 0.01, innerUp: 0.34, wide: 1, asym: 0 },
  curious: { smile: 0.45, raise: 0.018, innerUp: -0.04, wide: 1.06, asym: 0.012 },
}

interface ArmPose {
  shX: number
  shZ: number
  elX: number
  elZ: number
  palm: number
  curl: number
  lift: number
}
const GESTURE_TIME: Record<Gesture, number> = { wave: 2.8, present: 3.4, shrug: 2.2, think: 2.6, point: 2.6 }

function armTarget(side: 1 | -1, gesture: Gesture | null, speaking: boolean, t: number): ArmPose {
  const rest: ArmPose = { shX: -0.5, shZ: side * 0.12, elX: -0.95, elZ: 0, palm: 1.3, curl: 0.35, lift: 0 }
  const right = side === -1
  // gestures use the character's right arm (x < 0); the left arm shrugs along
  if (gesture === 'wave' && right) return { shX: 0.35, shZ: side * 2.3, elX: 0, elZ: side * (0.84 + 0.45 * Math.sin(t * 9)), palm: 0, curl: 0.05, lift: 0.01 }
  if (gesture === 'present' && right) return { shX: -0.95, shZ: side * 0.2, elX: -0.55, elZ: 0, palm: -1.2, curl: 0.12, lift: 0 }
  if (gesture === 'think' && right) return { shX: -0.7, shZ: -side * 0.18, elX: -2.3, elZ: 0, palm: 0.2, curl: 0.6, lift: 0 }
  if (gesture === 'point' && right) return { shX: -1.25, shZ: side * 0.1, elX: -0.25, elZ: 0, palm: 0, curl: 0.1, lift: 0 }
  if (gesture === 'shrug') return { shX: -0.3, shZ: side * 0.55, elX: -1.55, elZ: 0, palm: -0.7, curl: 0.15, lift: 0.025 }
  if (speaking) {
    if (right) {
      return {
        shX: -0.68 + 0.1 * Math.sin(t * 2.7),
        shZ: side * (-0.08 + 0.12 * Math.sin(t * 1.9)),
        elX: -1.35 + 0.3 * Math.sin(t * 2.7 + 0.8),
        elZ: 0,
        palm: 0.2 + 0.6 * Math.sin(t * 1.6),
        curl: 0.25 + 0.1 * Math.sin(t * 2.7),
        lift: 0,
      }
    }
    return { ...rest, shX: -0.5 + 0.06 * Math.sin(t * 2.1 + 1.3), elX: -0.95 + 0.14 * Math.sin(t * 2.1 + 2.2) }
  }
  return { ...rest, shX: rest.shX + Math.sin(t * 1.1 + side) * 0.012, elX: rest.elX + Math.sin(t * 0.9 + side) * 0.01 }
}

interface ArmRefs {
  sh: RefObject<THREE.Group | null>
  el: RefObject<THREE.Group | null>
  wr: RefObject<THREE.Group | null>
  fingers: RefObject<THREE.Group | null>
  thumb: RefObject<THREE.Group | null>
}

function useArmRefs(): ArmRefs {
  return {
    sh: useRef<THREE.Group>(null),
    el: useRef<THREE.Group>(null),
    wr: useRef<THREE.Group>(null),
    fingers: useRef<THREE.Group>(null),
    thumb: useRef<THREE.Group>(null),
  }
}

type Mats = ReturnType<typeof useCharacterMaterials>
function useCharacterMaterials() {
  return useMemo(() => {
    const std = (color: string, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
    return {
      skin: std('#e2ad88', 0.55),
      skinShade: std('#d29a76', 0.6),
      hair: std('#3a2216', 0.45, 0.1),
      blazer: std('#5b1f2c', 0.78),
      blazerLight: std('#74303e', 0.75),
      blouse: std('#f1e9d6', 0.7),
      trousers: std('#1f1c24', 0.8),
      shoe: std('#17120f', 0.4, 0.2),
      white: std('#f7f4ee', 0.35),
      iris: std('#4f7a52', 0.3),
      pupil: std('#080808', 0.2),
      lips: std('#b34e58', 0.4),
      mouth: std('#3a0d11', 0.8),
      brow: std('#2c1a10', 0.7),
      gold: std('#d4ac55', 0.28, 0.9),
      scarf: std('#c79a45', 0.5, 0.2),
      blush: new THREE.MeshStandardMaterial({ color: '#e9958a', roughness: 0.9, transparent: true, opacity: 0.32 }),
      lens: new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.1 }),
    }
  }, [])
}

function Hand({ side, refs, m }: { side: 1 | -1; refs: ArmRefs; m: Mats }) {
  const fx: number[] = [-0.024, -0.008, 0.008, 0.024]
  const len: number[] = [0.04, 0.047, 0.045, 0.036]
  return (
    <group ref={refs.wr} position={[0, -0.27, 0]}>
      <mesh position={[0, -0.04, 0]} material={m.skin} castShadow>
        <boxGeometry args={[0.026, 0.08, 0.066]} />
      </mesh>
      <group ref={refs.fingers} position={[0, -0.08, 0]}>
        {fx.map((z, i) => (
          <mesh key={i} position={[0, -len[i] / 2, z]} material={m.skin}>
            <capsuleGeometry args={[0.0085, len[i], 4, 8]} />
          </mesh>
        ))}
      </group>
      <group ref={refs.thumb} position={[0, -0.025, 0.036]} rotation={[0.5, 0, -side * 0.2]}>
        <mesh position={[0, -0.02, 0.004]} material={m.skin}>
          <capsuleGeometry args={[0.009, 0.035, 4, 8]} />
        </mesh>
      </group>
    </group>
  )
}

function Arm({ side, refs, m }: { side: 1 | -1; refs: ArmRefs; m: Mats }) {
  return (
    <group ref={refs.sh} position={[side * 0.225, 1.41, 0]}>
      <mesh material={m.blazer} castShadow>
        <sphereGeometry args={[0.058, 16, 12]} />
      </mesh>
      <mesh position={[0, -0.15, 0]} material={m.blazer} castShadow>
        <capsuleGeometry args={[0.043, 0.2, 6, 14]} />
      </mesh>
      <group ref={refs.el} position={[0, -0.3, 0]}>
        <mesh material={m.blazer}>
          <sphereGeometry args={[0.04, 14, 10]} />
        </mesh>
        <mesh position={[0, -0.14, 0]} material={m.blazer} castShadow>
          <capsuleGeometry args={[0.035, 0.17, 6, 14]} />
        </mesh>
        <mesh position={[0, -0.245, 0]} material={m.blouse}>
          <cylinderGeometry args={[0.035, 0.032, 0.035, 14]} />
        </mesh>
        <Hand side={side} refs={refs} m={m} />
      </group>
    </group>
  )
}

export function Librarian() {
  const m = useCharacterMaterials()
  const { camera } = useThree()

  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Group>(null)
  const eyeL = useRef<THREE.Group>(null)
  const eyeR = useRef<THREE.Group>(null)
  const browL = useRef<THREE.Mesh>(null)
  const browR = useRef<THREE.Mesh>(null)
  const smileMesh = useRef<THREE.Mesh>(null)
  const openMesh = useRef<THREE.Mesh>(null)
  const armL = useArmRefs() // side +1
  const armR = useArmRefs() // side -1

  const st = useRef({
    yaw: 0,
    pitch: 0,
    roll: 0,
    smile: 0.8,
    raise: 0,
    innerUp: 0,
    wide: 1,
    asym: 0,
    open: 0,
    blink: 0,
    nextBlink: 2,
    blinkT: -1,
    gesture: null as Gesture | null,
    gestureUntil: 0,
    lastNonce: -1,
    wasNear: false,
    arms: {
      1: { shX: -0.5, shZ: 0.12, elX: -0.95, elZ: 0, palm: 1.3, curl: 0.35, lift: 0 } as ArmPose,
      '-1': { shX: -0.5, shZ: -0.12, elX: -0.95, elZ: 0, palm: 1.3, curl: 0.35, lift: 0 } as ArmPose,
    } as Record<string, ArmPose>,
  })
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // gestures requested by the conversation
  useEffect(() => {
    return useLibrary.subscribe((s, prev) => {
      if (s.librarian.gestureNonce !== prev.librarian.gestureNonce && s.librarian.gesture) {
        st.current.gesture = s.librarian.gesture
        st.current.gestureUntil = performance.now() / 1000 + GESTURE_TIME[s.librarian.gesture]
      }
    })
  }, [])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const S = st.current
    const lib = useLibrary.getState()
    const { speaking, mood } = lib.librarian
    const near = lib.nearLibrarian && lib.view === 'library'
    const now = performance.now() / 1000

    // greeting wave when the visitor arrives
    if (near && !S.wasNear) {
      S.gesture = 'wave'
      S.gestureUntil = now + GESTURE_TIME.wave
    }
    S.wasNear = near
    if (S.gesture && now > S.gestureUntil) S.gesture = null
    const gesture = S.gesture

    // ----- target mood ------------------------------------------------------
    let moodKey: Mood = mood
    if (gesture === 'wave' && !speaking) moodKey = 'excited'
    if (!speaking && !near && !gesture) moodKey = 'happy'
    const mt = MOODS[moodKey]
    S.smile = damp(S.smile, mt.smile, 5, dt)
    S.raise = damp(S.raise, mt.raise + (gesture === 'shrug' ? 0.015 : 0), 5, dt)
    S.innerUp = damp(S.innerUp, mt.innerUp, 5, dt)
    S.wide = damp(S.wide, mt.wide, 6, dt)
    S.asym = damp(S.asym, mt.asym, 5, dt)

    // ----- head tracking ------------------------------------------------------
    const r = root.current
    const h = head.current
    if (r && h) {
      r.updateWorldMatrix(true, false)
      tmp.copy(camera.position)
      r.worldToLocal(tmp)
      const dist = Math.hypot(tmp.x, tmp.z)
      const tracking = (near || speaking) && dist < 16 && tmp.z > -1
      let ty = Math.sin(t * 0.31) * 0.22 + Math.sin(t * 0.13) * 0.1
      let tp = Math.sin(t * 0.23) * 0.05
      if (tracking) {
        ty = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.0, 1.0)
        tp = THREE.MathUtils.clamp(-Math.atan2(tmp.y - 1.65, dist), -0.35, 0.4)
      }
      if (moodKey === 'thinking') {
        ty += 0.25
        tp -= 0.12
      }
      let roll = 0
      if (gesture === 'shrug') roll = 0.12
      if (gesture === 'think') roll = -0.08
      if (moodKey === 'curious') roll += 0.05
      if (speaking) {
        tp += Math.sin(t * 2.4) * 0.03
        ty += Math.sin(t * 1.7) * 0.04
      }
      S.yaw = damp(S.yaw, ty, 4, dt)
      S.pitch = damp(S.pitch, tp, 4, dt)
      S.roll = damp(S.roll, roll, 4, dt)
      h.rotation.set(S.pitch, S.yaw, S.roll)

      // eyes follow a little further than the head
      const gy = THREE.MathUtils.clamp((ty - S.yaw) * 0.9, -0.35, 0.35)
      const gp = THREE.MathUtils.clamp((tp - S.pitch) * 0.9, -0.25, 0.25)
      for (const e of [eyeL.current, eyeR.current]) if (e) e.rotation.set(gp, gy, 0)
    }

    // ----- blinking --------------------------------------------------------------
    S.nextBlink -= dt
    if (S.nextBlink <= 0) {
      S.blinkT = 0
      S.nextBlink = 2 + Math.random() * 3.5
    }
    let blink = 0
    if (S.blinkT >= 0) {
      S.blinkT += dt
      blink = Math.sin((S.blinkT / 0.16) * Math.PI)
      if (S.blinkT > 0.16) {
        S.blinkT = -1
        blink = 0
      }
    }
    const eyeScale = Math.max(0.06, (1 - blink * 0.94) * S.wide)
    if (eyeL.current) eyeL.current.scale.set(1, eyeScale, 1)
    if (eyeR.current) eyeR.current.scale.set(1, eyeScale, 1)

    // ----- brows ----------------------------------------------------------------
    if (browL.current && browR.current) {
      // browL sits at x>0 (side +1), browR at x<0 (side -1)
      browL.current.position.y = 0.062 + S.raise + S.asym
      browR.current.position.y = 0.062 + S.raise - S.asym * 0.4
      browL.current.rotation.z = -S.innerUp * 1
      browR.current.rotation.z = S.innerUp * 1
    }

    // ----- mouth ----------------------------------------------------------------
    const talk = speaking ? 0.22 + 0.78 * Math.abs(Math.sin(t * 10.5 + Math.sin(t * 3.1) * 2)) * (0.65 + 0.35 * Math.sin(t * 2.3)) : 0
    S.open = damp(S.open, talk, 22, dt)
    if (smileMesh.current) {
      const s = S.smile * (1 - S.open * 0.35)
      smileMesh.current.scale.set(1 + Math.abs(s) * 0.18, s, 1)
      smileMesh.current.position.y = s < 0 ? -0.01 : 0
    }
    if (openMesh.current) {
      openMesh.current.scale.set(1.2, 0.04 + S.open * 1.0, 0.5)
      openMesh.current.visible = S.open > 0.05
    }

    // ----- body + arms -------------------------------------------------------------
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.6) * 0.0035
      body.current.rotation.set(0.1 + Math.sin(t * 1.6) * 0.004, S.yaw * 0.25, Math.sin(t * 0.5) * 0.01)
    }
    if (torso.current) torso.current.scale.set(1.22, 1 + Math.sin(t * 1.6) * 0.012, 0.72)

    const apply = (side: 1 | -1, refs: ArmRefs) => {
      const key = String(side)
      const cur = S.arms[key]
      const tgt = armTarget(side, gesture, speaking, t)
      const lam = gesture === 'wave' ? 9 : 6
      cur.shX = damp(cur.shX, tgt.shX, lam, dt)
      cur.shZ = damp(cur.shZ, tgt.shZ, lam, dt)
      cur.elX = damp(cur.elX, tgt.elX, lam, dt)
      cur.elZ = damp(cur.elZ, tgt.elZ, gesture === 'wave' ? 14 : lam, dt)
      cur.palm = damp(cur.palm, tgt.palm, 6, dt)
      cur.curl = damp(cur.curl, tgt.curl, 8, dt)
      cur.lift = damp(cur.lift, tgt.lift, 6, dt)
      if (refs.sh.current) {
        refs.sh.current.rotation.set(cur.shX, 0, cur.shZ)
        refs.sh.current.position.y = 1.41 + cur.lift
      }
      if (refs.el.current) refs.el.current.rotation.set(cur.elX, 0, cur.elZ)
      if (refs.wr.current) refs.wr.current.rotation.set(0, -side * cur.palm, 0)
      if (refs.fingers.current) refs.fingers.current.rotation.set(0, 0, -side * cur.curl * 1.4)
      if (refs.thumb.current) refs.thumb.current.rotation.set(0.5, 0, -side * (0.2 + cur.curl * 0.5))
    }
    apply(1, armL)
    apply(-1, armR)
  })

  return (
    <group ref={root} position={LIBRARIAN_POS}>
      <group ref={body}>
        {/* legs + shoes */}
        {([-1, 1] as const).map((x) => (
          <group key={x}>
            <mesh position={[x * 0.085, 0.47, 0]} material={m.trousers} castShadow>
              <cylinderGeometry args={[0.07, 0.062, 0.94, 14]} />
            </mesh>
            <mesh position={[x * 0.085, 0.03, 0.05]} material={m.shoe}>
              <boxGeometry args={[0.1, 0.06, 0.26]} />
            </mesh>
          </group>
        ))}
        {/* hips + belt */}
        <mesh position={[0, 0.98, 0]} material={m.trousers} scale={[1.1, 1, 0.7]}>
          <cylinderGeometry args={[0.17, 0.17, 0.2, 20]} />
        </mesh>
        <mesh position={[0, 1.08, 0]} material={m.gold} scale={[1.1, 1, 0.7]}>
          <cylinderGeometry args={[0.172, 0.172, 0.018, 20]} />
        </mesh>
        {/* blazer */}
        <mesh ref={torso} position={[0, 1.2, 0]} material={m.blazer} castShadow>
          <capsuleGeometry args={[0.16, 0.24, 8, 22]} />
        </mesh>
        <mesh position={[0, 1.4, 0]} material={m.blazer} scale={[1.38, 0.5, 0.78]} castShadow>
          <sphereGeometry args={[0.16, 22, 14]} />
        </mesh>
        {/* blouse, lapels, scarf */}
        <mesh position={[0, 1.34, 0.113]} material={m.blouse} rotation={[0.04, 0, 0]}>
          <boxGeometry args={[0.13, 0.26, 0.012]} />
        </mesh>
        {([-1, 1] as const).map((x) => (
          <mesh key={x} position={[x * 0.082, 1.34, 0.122]} rotation={[0.04, 0, x * -0.3]} material={m.blazerLight}>
            <boxGeometry args={[0.055, 0.29, 0.014]} />
          </mesh>
        ))}
        <mesh position={[0, 1.35, 0.13]} material={m.scarf}>
          <boxGeometry args={[0.032, 0.2, 0.012]} />
        </mesh>
        <mesh position={[0, 1.44, 0.128]} material={m.scarf}>
          <sphereGeometry args={[0.024, 12, 10]} />
        </mesh>
        <mesh position={[0.07, 1.27, 0.136]} material={m.gold}>
          <boxGeometry args={[0.045, 0.014, 0.004]} />
        </mesh>
        {/* neck + collar */}
        <mesh position={[0, 1.515, 0]} material={m.skin}>
          <cylinderGeometry args={[0.046, 0.052, 0.13, 16]} />
        </mesh>
        <mesh position={[0, 1.465, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.blouse}>
          <torusGeometry args={[0.06, 0.016, 8, 24]} />
        </mesh>

        <Arm side={1} refs={armL} m={m} />
        <Arm side={-1} refs={armR} m={m} />

        {/* ------------------------------ head ------------------------------ */}
        <group ref={head} position={[0, 1.56, 0]}>
          <group position={[0, 0.115, 0.012]}>
            <mesh material={m.skin} scale={[0.92, 1.13, 0.98]} castShadow>
              <sphereGeometry args={[0.105, 32, 24]} />
            </mesh>
            <mesh material={m.skin} position={[0, -0.062, 0.026]} scale={[0.95, 0.9, 0.95]}>
              <sphereGeometry args={[0.078, 24, 18]} />
            </mesh>
            {/* nose, ears */}
            <mesh material={m.skinShade} position={[0, -0.014, 0.106]} scale={[0.9, 1.35, 1.1]}>
              <sphereGeometry args={[0.017, 14, 10]} />
            </mesh>
            {([-1, 1] as const).map((x) => (
              <mesh key={x} material={m.skin} position={[x * 0.097, -0.005, -0.005]} scale={[0.5, 1, 0.8]}>
                <sphereGeometry args={[0.023, 12, 10]} />
              </mesh>
            ))}
            {/* cheeks */}
            {([-1, 1] as const).map((x) => (
              <mesh key={x} material={m.blush} position={[x * 0.058, -0.022, 0.083]} scale={[1.2, 0.8, 0.3]}>
                <sphereGeometry args={[0.02, 12, 8]} />
              </mesh>
            ))}
            {/* eyes */}
            {([1, -1] as const).map((x) => (
              <group key={x} ref={x === 1 ? eyeL : eyeR} position={[x * 0.04, 0.022, 0.083]}>
                <mesh material={m.white} scale={[1, 0.88, 0.7]}>
                  <sphereGeometry args={[0.0185, 16, 12]} />
                </mesh>
                <mesh material={m.iris} position={[0, 0, 0.0085]}>
                  <sphereGeometry args={[0.0118, 14, 10]} />
                </mesh>
                <mesh material={m.pupil} position={[0, 0, 0.0128]}>
                  <sphereGeometry args={[0.0058, 10, 8]} />
                </mesh>
              </group>
            ))}
            {/* brows */}
            <mesh ref={browL} material={m.brow} position={[0.04, 0.062, 0.093]}>
              <boxGeometry args={[0.05, 0.0085, 0.01]} />
            </mesh>
            <mesh ref={browR} material={m.brow} position={[-0.04, 0.062, 0.093]}>
              <boxGeometry args={[0.05, 0.0085, 0.01]} />
            </mesh>
            {/* glasses */}
            {([-1, 1] as const).map((x) => (
              <group key={x}>
                <mesh material={m.gold} position={[x * 0.04, 0.022, 0.1]}>
                  <torusGeometry args={[0.031, 0.0028, 8, 28]} />
                </mesh>
                <mesh material={m.lens} position={[x * 0.04, 0.022, 0.1]}>
                  <circleGeometry args={[0.03, 20]} />
                </mesh>
                <mesh material={m.gold} position={[x * 0.077, 0.028, 0.05]}>
                  <boxGeometry args={[0.004, 0.004, 0.1]} />
                </mesh>
              </group>
            ))}
            <mesh material={m.gold} position={[0, 0.03, 0.102]}>
              <boxGeometry args={[0.02, 0.004, 0.004]} />
            </mesh>
            {/* mouth */}
            <group position={[0, -0.055, 0.094]}>
              <mesh ref={openMesh} material={m.mouth} position={[0, -0.002, 0]} visible={false}>
                <sphereGeometry args={[0.02, 14, 10]} />
              </mesh>
              <mesh ref={smileMesh} material={m.lips} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.027, 0.0036, 8, 20, Math.PI]} />
              </mesh>
            </group>
            {/* hair: cap, bob and bun */}
            <mesh material={m.hair} position={[0, 0.006, -0.012]} rotation={[-0.45, 0, 0]} scale={[0.99, 1.2, 1.08]} castShadow>
              <sphereGeometry args={[0.108, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
            </mesh>
            <mesh material={m.hair} position={[0, -0.035, -0.055]} scale={[1.08, 1.2, 0.72]}>
              <sphereGeometry args={[0.1, 24, 18]} />
            </mesh>
            {([-1, 1] as const).map((x) => (
              <mesh key={x} material={m.hair} position={[x * 0.096, -0.025, -0.01]} scale={[0.5, 1.5, 0.9]}>
                <sphereGeometry args={[0.03, 12, 10]} />
              </mesh>
            ))}
            <mesh material={m.hair} position={[0, 0.115, -0.085]}>
              <sphereGeometry args={[0.048, 16, 12]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
