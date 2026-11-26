import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { BOUNDS, COLLIDERS, EYE, INTERACTABLES, SPAWN, type Pose } from '../lib/layout'
import { useLibrary } from '../store'

const RADIUS = 0.36
const BASE_FOV = 62
const damp = THREE.MathUtils.damp
const lerp = THREE.MathUtils.lerp

function easeInOut(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function resolve(p: { x: number; z: number }) {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < COLLIDERS.length; i++) {
      const b = COLLIDERS[i]
      const cx = Math.max(b.x0, Math.min(p.x, b.x1))
      const cz = Math.max(b.z0, Math.min(p.z, b.z1))
      const dx = p.x - cx
      const dz = p.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          p.x = cx + (dx / d) * RADIUS
          p.z = cz + (dz / d) * RADIUS
        } else {
          // centre is inside the box: leave through the nearest side
          const l = p.x - b.x0
          const r = b.x1 - p.x
          const t = p.z - b.z0
          const bt = b.z1 - p.z
          const m = Math.min(l, r, t, bt)
          if (m === l) p.x = b.x0 - RADIUS
          else if (m === r) p.x = b.x1 + RADIUS
          else if (m === t) p.z = b.z0 - RADIUS
          else p.z = b.z1 + RADIUS
        }
      }
    }
  }
  p.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, p.x))
  p.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, p.z))
}

interface ActiveTween {
  nonce: number
  from: { x: number; y: number; z: number; yaw: number; pitch: number; fov: number }
  to: Pose
  t: number
  dur: number
  then?: () => void
}

function isTyping(el: EventTarget | null) {
  const n = el as HTMLElement | null
  if (!n || !n.tagName) return false
  return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable
}

export function Player() {
  const { camera, gl } = useThree()
  const S = useRef({
    x: SPAWN.x,
    y: 2.7,
    z: SPAWN.z,
    yaw: SPAWN.yaw,
    pitch: SPAWN.pitch,
    fov: 55,
    targetFov: BASE_FOV,
    vx: 0,
    vz: 0,
    bob: 0,
    keys: {} as Record<string, boolean>,
    drag: false,
    lx: 0,
    ly: 0,
    tw: null as ActiveTween | null,
    tweenNonce: -1,
    lastView: 'welcome' as 'welcome' | 'library',
  })

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    const el = gl.domElement
    el.style.touchAction = 'none'
    const s = S.current

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const lib = useLibrary.getState()
      if (e.code === 'Escape') {
        if (lib.detailId !== null) lib.openDetail(null)
        else if (lib.panel) lib.closePanel()
        return
      }
      if (lib.view !== 'library') return
      if (e.code === 'KeyE' || e.code === 'Enter') {
        if (lib.nearby && !lib.panel) {
          e.preventDefault()
          lib.activate(lib.nearby)
        }
        return
      }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
      s.keys[e.code] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      s.keys[e.code] = false
    }
    const onBlur = () => {
      s.keys = {}
    }
    const onDown = (e: PointerEvent) => {
      if (useLibrary.getState().view !== 'library') return
      s.drag = true
      s.lx = e.clientX
      s.ly = e.clientY
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!s.drag || s.tw) return
      const sens = useLibrary.getState().prefs.sensitivity
      const dx = e.clientX - s.lx
      const dy = e.clientY - s.ly
      s.lx = e.clientX
      s.ly = e.clientY
      s.yaw -= dx * 0.0042 * sens
      s.pitch = Math.max(-1.25, Math.min(1.25, s.pitch - dy * 0.0034 * sens))
    }
    const onUp = (e: PointerEvent) => {
      s.drag = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const onWheel = (e: WheelEvent) => {
      if (useLibrary.getState().view !== 'library') return
      e.preventDefault()
      s.targetFov = Math.max(30, Math.min(88, s.targetFov + e.deltaY * 0.04))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [camera, gl])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = S.current
    const lib = useLibrary.getState()
    const cam = camera as THREE.PerspectiveCamera
    const t = state.clock.elapsedTime

    // ------------------------------------------------------- welcome: attract
    if (lib.view === 'welcome') {
      const a = t * 0.11
      s.x = Math.sin(a) * 4.6
      s.z = 8.4 + Math.cos(a) * 1.4
      s.y = 2.7 + Math.sin(t * 0.2) * 0.25
      const tx = Math.sin(a * 0.7) * 1.8
      const tz = -11
      const ty = 2.1
      s.yaw = Math.atan2(-(tx - s.x), -(tz - s.z))
      s.pitch = Math.atan2(ty - s.y, Math.hypot(tx - s.x, tz - s.z))
      s.fov = damp(s.fov, 52, 3, dt)
      cam.position.set(s.x, s.y, s.z)
      cam.rotation.set(s.pitch, s.yaw, 0, 'YXZ')
      if (Math.abs(cam.fov - s.fov) > 0.01) {
        cam.fov = s.fov
        cam.updateProjectionMatrix()
      }
      s.lastView = 'welcome'
      return
    }
    s.lastView = 'library'

    // -------------------------------------------------------------- tweens
    const req = lib.tween
    if (req && req.nonce !== s.tweenNonce) {
      s.tweenNonce = req.nonce
      s.tw = { nonce: req.nonce, from: { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, fov: s.fov }, to: req.pose, t: 0, dur: Math.max(0.2, req.duration), then: req.then }
      s.targetFov = req.pose.fov ?? BASE_FOV
      s.vx = s.vz = 0
    }
    if (s.tw) {
      const tw = s.tw
      tw.t += dt
      const k = Math.min(1, tw.t / tw.dur)
      const e = easeInOut(k)
      s.x = lerp(tw.from.x, tw.to.x, e)
      s.z = lerp(tw.from.z, tw.to.z, e)
      s.y = lerp(tw.from.y, EYE, e)
      s.yaw = lerpAngle(tw.from.yaw, tw.to.yaw, e)
      s.pitch = lerp(tw.from.pitch, tw.to.pitch, e)
      s.fov = lerp(tw.from.fov, tw.to.fov ?? BASE_FOV, e)
      if (k >= 1) {
        const then = tw.then
        s.tw = null
        if (useLibrary.getState().tween?.nonce === tw.nonce) lib.clearTween()
        if (then) then()
      }
    } else {
      // ------------------------------------------------------ free movement
      const k = s.keys
      const v = lib.virtualKeys
      const fwd = (k.KeyW || k.ArrowUp || v.fwd ? 1 : 0) - (k.KeyS || k.ArrowDown || v.back ? 1 : 0)
      const strafe = (k.KeyD || v.right ? 1 : 0) - (k.KeyA || v.left ? 1 : 0)
      const turn = (k.ArrowLeft || v.turnL ? 1 : 0) - (k.ArrowRight || v.turnR ? 1 : 0)
      s.yaw += turn * 1.9 * dt * lib.prefs.sensitivity
      const run = k.ShiftLeft || k.ShiftRight ? 1.75 : 1
      const speed = 3.1 * run
      const fx = -Math.sin(s.yaw)
      const fz = -Math.cos(s.yaw)
      const rx = Math.cos(s.yaw)
      const rz = -Math.sin(s.yaw)
      let mx = fx * fwd + rx * strafe
      let mz = fz * fwd + rz * strafe
      const len = Math.hypot(mx, mz)
      if (len > 1) {
        mx /= len
        mz /= len
      }
      s.vx = damp(s.vx, mx * speed, 12, dt)
      s.vz = damp(s.vz, mz * speed, 12, dt)
      const p = { x: s.x + s.vx * dt, z: s.z + s.vz * dt }
      resolve(p)
      const moved = Math.hypot(p.x - s.x, p.z - s.z) / Math.max(dt, 1e-4)
      s.x = p.x
      s.z = p.z
      s.bob += dt * Math.min(moved, 6) * 2.6
      s.y = EYE + Math.sin(s.bob) * 0.022 * Math.min(1, moved / 2)
      s.fov = damp(s.fov, s.targetFov, 8, dt)
    }

    // -------------------------------------------------------------- camera
    cam.position.set(s.x, s.y, s.z)
    cam.rotation.set(s.pitch, s.yaw, 0, 'YXZ')
    if (Math.abs(cam.fov - s.fov) > 0.01) {
      cam.fov = s.fov
      cam.updateProjectionMatrix()
    }

    // ------------------------------------------------- proximity detection
    let best: string | null = null
    let bestScore = 1
    for (let i = 0; i < INTERACTABLES.length; i++) {
      const it = INTERACTABLES[i]
      const d = Math.hypot(s.x - it.x, s.z - it.z)
      if (d < it.radius) {
        const score = d / it.radius
        if (score < bestScore) {
          bestScore = score
          best = it.id
        }
      }
    }
    lib.setNearby(s.tw ? null : best)
    const dl = Math.hypot(s.x, s.z + 11.1)
    lib.setNearLibrarian(lib.nearLibrarian ? dl < 8.2 : dl < 6.6)
    lib.setNearShelves(Math.abs(s.x) > 7.8)
  })

  return null
}
