import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CABINET_POS, DESK, GLOBE_POS, INTERACTABLES, ORRERY_POS, PODIUM_POS, TABLES } from '../lib/layout'
import type { Quality } from '../lib/storage'
import { useLibrary } from '../store'
import { Ball, Box, Cyl, mats, type V3 } from './kit'
import { makeLabelTexture } from './textures'

/* ---------------------------------------------------------- click wrapper ---- */

function Clickable({ id, children, p = [0, 0, 0] }: { id: string; children: ReactNode; p?: V3 }) {
  const goTo = useLibrary((s) => s.goTo)
  return (
    <group
      position={p}
      onClick={(e) => {
        if (e.delta > 6) return
        e.stopPropagation()
        goTo(id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      {children}
    </group>
  )
}

/* ------------------------------------------------------------------- bits ---- */

function BankerLamp({ p, rotY = 0, light = false }: { p: V3; rotY?: number; light?: boolean }) {
  const M = mats()
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Cyl p={[0, 0.015, 0]} d={[0.07, 0.08, 0.03]} m={M.brass} seg={16} />
      <Cyl p={[0, 0.17, 0]} d={[0.012, 0.012, 0.3]} m={M.brass} seg={8} />
      <mesh position={[0, 0.34, 0.02]} rotation={[0, 0, Math.PI / 2]} material={M.lampGlass}>
        <cylinderGeometry args={[0.07, 0.07, 0.22, 16, 1, false, 0, Math.PI]} />
      </mesh>
      {light && <pointLight position={[0, 0.3, 0.08]} intensity={5} distance={5} decay={2} color="#ffc98a" />}
    </group>
  )
}

function Chair({ p, rotY }: { p: V3; rotY: number }) {
  const M = mats()
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.46, 0]} s={[0.5, 0.06, 0.5]} m={M.leather} />
      <Box p={[0, 0.78, -0.22]} s={[0.5, 0.58, 0.05]} m={M.walnut} />
      <Box p={[0, 0.78, -0.2]} s={[0.4, 0.42, 0.03]} m={M.leather} />
      {([-1, 1] as const).map((x) =>
        ([-1, 1] as const).map((z) => <Box key={`${x}${z}`} p={[x * 0.21, 0.22, z * 0.21]} s={[0.05, 0.44, 0.05]} m={M.walnut} />),
      )}
    </group>
  )
}

function BookProp({ p, c, s = [0.22, 0.04, 0.3], r = [0, 0, 0] }: { p: V3; c: string; s?: V3; r?: V3 }) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), [c])
  const M = mats()
  return (
    <group position={p} rotation={r}>
      <Box s={s} m={m} cast={false} />
      <Box p={[0.012, 0, 0.0]} s={[s[0] - 0.02, s[1] - 0.012, s[2] - 0.01]} m={M.paper} cast={false} />
    </group>
  )
}

function ReadingTable({ p, lamp }: { p: V3; lamp: boolean }) {
  const M = mats()
  return (
    <group position={p}>
      <Box p={[0, 0.76, 0]} s={[3.4, 0.08, 1.5]} m={M.oak} />
      <Box p={[0, 0.68, 0]} s={[3.0, 0.1, 1.1]} m={M.dark} />
      {([-1, 1] as const).map((x) =>
        ([-1, 1] as const).map((z) => <Box key={`${x}${z}`} p={[x * 1.55, 0.36, z * 0.62]} s={[0.12, 0.72, 0.12]} m={M.walnut} />),
      )}
      <Chair p={[-0.8, 0, 1.0]} rotY={Math.PI} />
      <Chair p={[0.8, 0, 1.0]} rotY={Math.PI} />
      <Chair p={[-0.8, 0, -1.0]} rotY={0} />
      <Chair p={[0.8, 0, -1.0]} rotY={0} />
      <BankerLamp p={[1.2, 0.8, 0.1]} rotY={-0.6} light={lamp} />
      <BookProp p={[-0.8, 0.82, 0.3]} c="#7b2d26" r={[0, 0.2, 0]} />
      <BookProp p={[-0.35, 0.82, -0.2]} c="#2f4a3a" r={[0, -0.3, 0]} />
      <BookProp p={[0.3, 0.82, 0.35]} c="#274b5a" s={[0.2, 0.05, 0.28]} r={[0, 0.5, 0]} />
      <BookProp p={[0.3, 0.87, 0.35]} c="#b08a47" s={[0.18, 0.04, 0.25]} r={[0, 0.2, 0]} />
    </group>
  )
}

function Plant({ p, s = 1 }: { p: V3; s?: number }) {
  const M = mats()
  const leaves = useMemo(() => {
    const out: { r: V3; y: number }[] = []
    for (let i = 0; i < 9; i++) out.push({ r: [0.5 + (i % 3) * 0.14, (i / 9) * Math.PI * 2, 0], y: 0.8 + (i % 4) * 0.12 })
    return out
  }, [])
  return (
    <group position={p} scale={s}>
      <Cyl p={[0, 0.3, 0]} d={[0.32, 0.22, 0.6]} m={M.pot} />
      {leaves.map((l, i) => (
        <group key={i} rotation={[0, l.r[1], 0]}>
          <Ball p={[0.18, l.y, 0]} rad={0.3} sc={[0.28, 1.1, 0.5]} m={M.leaf} cast />
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------- reception desk ----- */

function ReceptionDesk() {
  const M = mats()
  const plate = useMemo(() => makeLabelTexture('ELARA QUILL', { w: 512, h: 160, sub: 'HEAD LIBRARIAN', bg: '#2a190d', fg: '#ebcb82', border: '#c9a24d' }), [])
  const panels: number[] = [-1.8, -0.9, 0, 0.9, 1.8]
  return (
    <Clickable id="librarian" p={[DESK.x, 0, DESK.z]}>
      <Box p={[0, 1.05, 0]} s={[4.7, 0.09, 1.55]} m={M.walnut} />
      <Box p={[0, 1.1, 0.74]} s={[4.7, 0.06, 0.1]} m={M.dark} />
      <Box p={[0, 0.5, -0.05]} s={[4.4, 1.0, 1.35]} m={M.dark} />
      {panels.map((x) => (
        <group key={x}>
          <Box p={[x, 0.52, 0.66]} s={[0.78, 0.74, 0.05]} m={M.walnut} />
          <Box p={[x, 0.52, 0.7]} s={[0.6, 0.56, 0.02]} m={M.dark} />
          <Box p={[x, 0.52, 0.715]} s={[0.5, 0.46, 0.012]} m={M.walnut} />
        </group>
      ))}
      <Box p={[0, 0.96, 0.7]} s={[4.5, 0.04, 0.06]} m={M.brass} cast={false} />
      <Box p={[0, 0.07, 0.7]} s={[4.5, 0.14, 0.06]} m={M.walnut} />
      <Box p={[-2.28, 0.55, 0.0]} s={[0.14, 1.1, 1.5]} m={M.walnut} />
      <Box p={[2.28, 0.55, 0.0]} s={[0.14, 1.1, 1.5]} m={M.walnut} />
      {/* brass nameplate */}
      <group position={[-1.5, 1.17, 0.4]} rotation={[-0.35, 0, 0]}>
        <Box s={[0.62, 0.2, 0.025]} m={M.brass} cast={false} />
        <mesh position={[0, 0, 0.014]}>
          <planeGeometry args={[0.56, 0.17]} />
          <meshStandardMaterial map={plate} roughness={0.5} />
        </mesh>
      </group>
      <BankerLamp p={[1.9, 1.1, -0.4]} rotY={-0.5} light />
      <Ball p={[-0.9, 1.12, 0.45]} rad={0.07} sc={[1, 0.6, 1]} m={M.brass} />
      <Cyl p={[-0.9, 1.1, 0.45]} d={[0.075, 0.08, 0.02]} m={M.brass} seg={16} />
      <BookProp p={[-1.9, 1.13, -0.3]} c="#7b2d26" s={[0.3, 0.05, 0.4]} r={[0, 0.2, 0]} />
      <BookProp p={[-1.9, 1.18, -0.3]} c="#1f3b57" s={[0.28, 0.05, 0.38]} r={[0, -0.1, 0]} />
      <BookProp p={[-1.9, 1.23, -0.3]} c="#4a3a28" s={[0.26, 0.05, 0.36]} r={[0, 0.3, 0]} />
      <BookProp p={[1.0, 1.12, -0.05]} c="#3d5a40" s={[0.5, 0.03, 0.34]} r={[0, 0.15, 0]} />
      {/* brass book stand where the recommended book is displayed */}
      <group position={[0.05, 1.1, 0.4]}>
        <Box p={[0, 0.0, 0]} s={[0.4, 0.02, 0.2]} m={M.brass} cast={false} />
        <Box p={[0, 0.04, 0.0]} s={[0.4, 0.04, 0.02]} m={M.brass} cast={false} />
      </group>
    </Clickable>
  )
}

/* ------------------------------------------------------------- orrery -------- */

function Orrery({ quality }: { quality: Quality }) {
  const M = mats()
  const spin = useRef<THREE.Group>(null)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const plaque = useMemo(() => makeLabelTexture('TRIE ORRERY', { w: 512, h: 128, sub: 'ALGORITHM EXPLORER', bg: '#1b1f2a', fg: '#8fe8ff', border: '#4fb4d0' }), [])
  const holo = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7fe6ff', toneMapped: false, transparent: true, opacity: 0.95 }), [])
  const holoLine = useMemo(() => new THREE.LineBasicMaterial({ color: '#59d0f0', transparent: true, opacity: 0.55, toneMapped: false }), [])
  const tree = useMemo(() => {
    const nodes: V3[] = [[0, 0, 0]]
    const lines: number[] = []
    const add = (parent: V3, count: number, radius: number, rise: number, phase: number) => {
      const out: V3[] = []
      for (let i = 0; i < count; i++) {
        const a = phase + (i / count) * Math.PI * 2
        const c: V3 = [parent[0] + Math.cos(a) * radius, parent[1] + rise, parent[2] + Math.sin(a) * radius]
        nodes.push(c)
        lines.push(...parent, ...c)
        out.push(c)
      }
      return out
    }
    const l1 = add([0, 0, 0], 4, 0.3, 0.32, 0.3)
    const l2: V3[] = []
    l1.forEach((n, i) => l2.push(...add(n, 3, 0.2, 0.3, i * 0.9)))
    l2.forEach((n, i) => add(n, 2, 0.12, 0.28, i * 1.3))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    return { nodes, geo }
  }, [])

  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.35
    rings.current.forEach((r, i) => {
      if (r) {
        r.rotation.x += dt * (0.3 + i * 0.17)
        r.rotation.z += dt * (0.2 - i * 0.07)
      }
    })
  })

  return (
    <Clickable id="algorithm" p={[ORRERY_POS.x, 0, ORRERY_POS.z]}>
      <Cyl p={[0, 0.06, 0]} d={[1.0, 1.05, 0.12]} m={M.stone} />
      <Cyl p={[0, 0.5, 0]} d={[0.6, 0.78, 0.8]} m={M.stone} />
      <Cyl p={[0, 0.95, 0]} d={[0.85, 0.65, 0.12]} m={M.brass} />
      <Cyl p={[0, 1.03, 0]} d={[0.7, 0.7, 0.04]} m={M.iron} />
      <mesh position={[0, 0.55, 0.69]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[0.7, 0.18]} />
        <meshStandardMaterial map={plaque} roughness={0.5} />
      </mesh>
      <group position={[0, 1.35, 0]}>
        <group ref={spin}>
          {tree.nodes.map((n, i) => (
            <Ball key={i} p={n} rad={i === 0 ? 0.07 : 0.035} m={holo} seg={10} />
          ))}
          <lineSegments geometry={tree.geo} material={holoLine} />
        </group>
        {[0.7, 0.9, 1.1].map((r, i) => (
          <mesh
            key={i}
            ref={(el) => {
              rings.current[i] = el
            }}
            rotation={[i * 0.9, 0, i * 0.5]}
            position={[0, 0.55, 0]}
          >
            <torusGeometry args={[r * 0.75, 0.012, 6, 64]} />
            <meshStandardMaterial color="#d9b866" metalness={0.9} roughness={0.3} emissive="#6a4e14" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
      {quality !== 'low' && <pointLight position={[0, 1.9, 0]} color="#78dcff" intensity={7} distance={7} decay={2} />}
    </Clickable>
  )
}

/* ------------------------------------------------- podium: the Great Index --- */

function Podium() {
  const M = mats()
  const open = useRef<THREE.Group>(null)
  const plaque = useMemo(() => makeLabelTexture('THE GREAT INDEX', { w: 512, h: 128, sub: '3,000 BOOKS · BROWSE & SEARCH', bg: '#2a190d', fg: '#ebcb82', border: '#c9a24d' }), [])
  useFrame(({ clock }) => {
    if (open.current) open.current.position.y = 1.2 + Math.sin(clock.elapsedTime * 1.4) * 0.012
  })
  return (
    <Clickable id="browse" p={[PODIUM_POS.x, 0, PODIUM_POS.z]}>
      <Box p={[0, 0.08, 0]} s={[0.9, 0.16, 0.9]} m={M.dark} />
      <Cyl p={[0, 0.6, 0]} d={[0.17, 0.22, 0.9]} m={M.walnut} />
      <Box p={[0, 1.06, 0]} s={[0.8, 0.08, 0.7]} m={M.dark} />
      <group position={[0, 1.1, 0]} rotation={[-0.4, 0, 0]}>
        <Box p={[0, 0.0, 0]} s={[0.84, 0.05, 0.62]} m={M.walnut} />
      </group>
      <group ref={open} position={[0, 1.2, 0.02]} rotation={[-0.4, 0, 0]}>
        <Box p={[-0.23, 0, 0]} s={[0.44, 0.05, 0.56]} m={M.leather} cast={false} />
        <Box p={[0.23, 0, 0]} s={[0.44, 0.05, 0.56]} m={M.leather} cast={false} />
        <Box p={[-0.23, 0.03, 0]} s={[0.4, 0.03, 0.52]} m={M.paper} cast={false} />
        <Box p={[0.23, 0.03, 0]} s={[0.4, 0.03, 0.52]} m={M.paper} cast={false} />
        <Box p={[0, 0.02, 0]} s={[0.03, 0.05, 0.56]} m={M.gold} cast={false} />
      </group>
      <mesh position={[0, 0.72, 0.205]}>
        <planeGeometry args={[0.7, 0.17]} />
        <meshStandardMaterial map={plaque} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 1.9, 0.6]} color="#ffd9a0" intensity={4} distance={5} decay={2} />
    </Clickable>
  )
}

/* ------------------------------------------------------ globe: about --------- */

function makeGlobeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = '#23527f'
  g.fillRect(0, 0, 512, 256)
  let a = 7
  const r = () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
  for (let i = 0; i < 22; i++) {
    g.fillStyle = i % 3 ? '#5f8a52' : '#b49a64'
    g.beginPath()
    g.ellipse(r() * 512, 40 + r() * 176, 14 + r() * 46, 10 + r() * 26, r() * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = 'rgba(255,255,255,0.12)'
  for (let x = 0; x < 512; x += 32) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, 256)
    g.stroke()
  }
  for (let y = 0; y < 256; y += 32) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(512, y)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function GlobeStation() {
  const M = mats()
  const globe = useRef<THREE.Mesh>(null)
  const map = useMemo(() => makeGlobeTexture(), [])
  const plaque = useMemo(() => makeLabelTexture('ABOUT THE PROJECT', { w: 512, h: 128, sub: 'HOW THE LIBRARY WORKS', bg: '#2a190d', fg: '#ebcb82', border: '#c9a24d' }), [])
  useFrame((_, dt) => {
    if (globe.current) globe.current.rotation.y += dt * 0.25
  })
  return (
    <Clickable id="about" p={[GLOBE_POS.x, 0, GLOBE_POS.z]}>
      <Cyl p={[0, 0.06, 0]} d={[0.5, 0.55, 0.12]} m={M.dark} />
      <Cyl p={[0, 0.5, 0]} d={[0.06, 0.1, 0.8]} m={M.walnut} />
      <Box p={[0, 0.93, 0]} s={[0.7, 0.05, 0.7]} m={M.walnut} />
      <group position={[0, 1.4, 0]} rotation={[0, 0, 0.4]}>
        <mesh ref={globe} castShadow>
          <sphereGeometry args={[0.38, 36, 24]} />
          <meshStandardMaterial map={map} roughness={0.5} metalness={0.05} />
        </mesh>
        <mesh material={M.brass} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.44, 0.02, 8, 48]} />
        </mesh>
        <Cyl p={[0, 0, 0]} d={[0.012, 0.012, 1.0]} m={M.brass} seg={6} />
      </group>
      <mesh position={[0, 0.82, 0.37]} rotation={[-0.3, 0, 0]}>
        <planeGeometry args={[0.64, 0.16]} />
        <meshStandardMaterial map={plaque} roughness={0.5} />
      </mesh>
    </Clickable>
  )
}

/* -------------------------------------------- card catalogue: search --------- */

function CardCatalogue() {
  const M = mats()
  const sign = useMemo(() => makeLabelTexture('CARD CATALOGUE', { w: 512, h: 128, sub: 'SEARCH BY PARTIAL TITLE', bg: '#2a190d', fg: '#ebcb82', border: '#c9a24d' }), [])
  const drawers: V3[] = []
  for (let col = 0; col < 6; col++) for (let row = 0; row < 5; row++) drawers.push([-1.0 + col * 0.4, 0.28 + row * 0.26, 0.37])
  return (
    <Clickable id="search" p={[CABINET_POS.x, 0, CABINET_POS.z]}>
      <Box p={[0, 0.82, 0]} s={[2.6, 1.64, 0.7]} m={M.walnut} />
      <Box p={[0, 1.68, 0.02]} s={[2.76, 0.08, 0.8]} m={M.dark} />
      {drawers.map((d, i) => (
        <group key={i} position={d}>
          <Box s={[0.36, 0.22, 0.04]} m={M.oak} cast={false} />
          <Box p={[0, 0.02, 0.03]} s={[0.1, 0.03, 0.03]} m={M.brass} cast={false} />
          <Box p={[0, -0.05, 0.022]} s={[0.12, 0.05, 0.01]} m={M.paper} cast={false} />
        </group>
      ))}
      <mesh position={[0, 2.35, 0.34]}>
        <planeGeometry args={[1.6, 0.4]} />
        <meshStandardMaterial map={sign} roughness={0.5} />
      </mesh>
      <Box p={[0, 2.35, 0.32]} s={[1.7, 0.48, 0.03]} m={M.brass} cast={false} />
      <BookProp p={[-0.8, 1.74, 0.05]} c="#2c2f4a" s={[0.3, 0.07, 0.4]} r={[0, 0.3, 0]} />
      <BankerLamp p={[0.85, 1.72, -0.05]} rotY={-0.4} />
    </Clickable>
  )
}

/* ------------------------------------------------------ reading nook -------- */

function Nook({ lamp }: { lamp: boolean }) {
  const M = mats()
  return (
    <group position={[8.5, 0, -8.2]} rotation={[0, -Math.PI / 2 - 0.2, 0]}>
      <Box p={[0, 0.3, 0]} s={[1.0, 0.32, 0.95]} m={M.leatherGreen} />
      <Box p={[0, 0.7, -0.4]} s={[1.0, 0.8, 0.2]} m={M.leatherGreen} />
      <Box p={[-0.5, 0.52, 0]} s={[0.16, 0.5, 0.95]} m={M.leatherGreen} />
      <Box p={[0.5, 0.52, 0]} s={[0.16, 0.5, 0.95]} m={M.leatherGreen} />
      <Box p={[0, 0.5, 0.05]} s={[0.84, 0.14, 0.7]} m={M.leatherGreen} />
      {([-1, 1] as const).map((x) =>
        ([-1, 1] as const).map((z) => <Box key={`${x}${z}`} p={[x * 0.42, 0.06, z * 0.4]} s={[0.07, 0.12, 0.07]} m={M.dark} />),
      )}
      <group position={[1.3, 0, -0.3]}>
        <Cyl p={[0, 0.03, 0]} d={[0.2, 0.22, 0.05]} m={M.brass} />
        <Cyl p={[0, 0.8, 0]} d={[0.02, 0.02, 1.6]} m={M.brass} seg={8} />
        <mesh position={[0, 1.65, 0]}>
          <cylinderGeometry args={[0.16, 0.26, 0.3, 20, 1, true]} />
          <meshStandardMaterial color="#f1d6a1" emissive="#ffcf8a" emissiveIntensity={0.9} side={THREE.DoubleSide} />
        </mesh>
        {lamp && <pointLight position={[0, 1.55, 0]} intensity={14} distance={9} decay={2} color="#ffc98a" />}
      </group>
      <Box p={[-1.0, 0.25, 0.1]} s={[0.5, 0.5, 0.5]} m={M.walnut} />
    </group>
  )
}

function Ladder() {
  const M = mats()
  const rungs: number[] = []
  for (let i = 0; i < 12; i++) rungs.push(0.35 + i * 0.33)
  return (
    <group position={[-10.95, 0, 4.2]} rotation={[0, 0, -0.17]}>
      <Box p={[0, 2.2, -0.2]} s={[0.05, 4.5, 0.05]} m={M.oak} />
      <Box p={[0, 2.2, 0.2]} s={[0.05, 4.5, 0.05]} m={M.oak} />
      {rungs.map((y) => (
        <Box key={y} p={[0, y, 0]} s={[0.05, 0.04, 0.44]} m={M.oak} cast={false} />
      ))}
    </group>
  )
}

/* ------------------------------------------------- floating markers --------- */

function Marker({ id, x, y, z }: { id: string; x: number; y: number; z: number }) {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false, transparent: true, opacity: 0.9 }), [])
  useFrame(({ clock }, dt) => {
    const near = useLibrary.getState().nearby === id
    const gr = g.current
    if (!gr) return
    const t = clock.elapsedTime
    gr.position.y = y + Math.sin(t * 2 + x) * 0.07
    gr.rotation.y += dt * (near ? 3.2 : 1.1)
    const target = near ? 1.7 : 1
    gr.scale.setScalar(THREE.MathUtils.damp(gr.scale.x, target, 8, dt))
    mat.opacity = near ? 1 : 0.55
  })
  return (
    <group ref={g} position={[x, y, z]}>
      <mesh material={mat}>
        <octahedronGeometry args={[0.12, 0]} />
      </mesh>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.012, 6, 32]} />
      </mesh>
    </group>
  )
}

export function Markers() {
  const items = INTERACTABLES.filter((i) => i.icon !== 'shelf')
  return (
    <group>
      {items.map((i) => (
        <Marker key={i.id} id={i.id} x={i.id === 'librarian' ? 0 : i.x} y={i.y} z={i.id === 'librarian' ? -12.32 : i.z} />
      ))}
    </group>
  )
}

/* --------------------------------------------------------------- all --------- */

export function Furniture({ quality }: { quality: Quality }) {
  const lamps = quality !== 'low'
  return (
    <group>
      <ReceptionDesk />
      <Orrery quality={quality} />
      <Podium />
      <GlobeStation />
      <CardCatalogue />
      {TABLES.map((t, i) => (
        <ReadingTable key={i} p={[t.x, 0, t.z]} lamp={lamps || i === 0} />
      ))}
      <Nook lamp={lamps} />
      <Ladder />
      <Plant p={[-10.3, 0, -14.6]} s={1.2} />
      <Plant p={[10.3, 0, -14.6]} s={1.2} />
      <Plant p={[-2.4, 0, 11]} s={1.1} />
      <Plant p={[2.4, 0, 11]} s={1.1} />
      <Markers />
    </group>
  )
}
