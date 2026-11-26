import { BOOKS, hashId, orderByTitle } from './catalog'

/* ============================================================================
 *  World layout: room, bookcases, shelving of all 3,000 books, interactables and
 *  collision boxes. Pure data – shared by the 3D scene, the HUD and the store.
 *  Camera convention: yaw 0 looks towards -Z, positive yaw turns left.
 * ========================================================================== */

export interface Pose {
  x: number
  z: number
  yaw: number
  pitch: number
  fov?: number
}

export const EYE = 1.65
export const ROOM = { x0: -12, x1: 12, z0: -16, z1: 12, h: 8.6 }

export function lookAtPose(x: number, z: number, tx: number, ty: number, tz: number, fov?: number): Pose {
  const dx = tx - x
  const dz = tz - z
  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.atan2(ty - EYE, Math.hypot(dx, dz))
  return { x, z, yaw, pitch, fov }
}

export const SPAWN: Pose = lookAtPose(0, 9.4, 0, 1.9, -11)

/* ------------------------------------------------------------------ cases -- */

export const CASE_W = 3.0
export const CASE_D = 0.52
export const CASE_H = 4.3
export const SHELVES = 7
export const SHELF_PITCH = 0.58
export const BOARD_Y0 = 0.14
export const BOARD_T = 0.05
const USABLE = 2.9

export interface CaseFace {
  index: number
  side: 'left' | 'right'
  /** centre on the wall plane */
  cx: number
  cz: number
  /** unit normal (pointing into the room) and direction "left to right" for a viewer */
  nx: number
  az: number
  rotY: number
  /** range in title order: [start, end) */
  start: number
  end: number
  label: string
}

const caseDefs: Omit<CaseFace, 'start' | 'end' | 'label'>[] = []
for (let i = 0; i < 6; i++) caseDefs.push({ index: i, side: 'left', cx: ROOM.x0, cz: 9 - i * 3.2, nx: 1, az: -1, rotY: Math.PI / 2 })
for (let i = 0; i < 6; i++) caseDefs.push({ index: 6 + i, side: 'right', cx: ROOM.x1, cz: -7 + i * 3.2, nx: -1, az: 1, rotY: -Math.PI / 2 })
export const CASE_COUNT = caseDefs.length

/* ------------------------------------------------------------ book shelving -- */

export interface Shelving {
  px: Float32Array
  py: Float32Array
  pz: Float32Array
  bw: Float32Array // thickness along the shelf
  bh: Float32Array
  bd: Float32Array
  caseOf: Uint8Array
  shelfOf: Uint8Array
  cases: CaseFace[]
}

export function boardTop(shelf: number): number {
  return BOARD_Y0 + shelf * SHELF_PITCH + BOARD_T / 2
}

function buildShelving(): Shelving {
  const n = BOOKS.length
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const pz = new Float32Array(n)
  const bw = new Float32Array(n)
  const bh = new Float32Array(n)
  const bd = new Float32Array(n)
  const caseOf = new Uint8Array(n)
  const shelfOf = new Uint8Array(n)
  const starts: number[] = []
  const ends: number[] = []

  let c = 0
  let s = 0
  let u = 0
  starts[0] = 0
  for (let r = 0; r < n; r++) {
    const id = orderByTitle[r]
    const t = 0.04 + (hashId(id, 11) % 8) * 0.0097
    if (u + t > USABLE) {
      u = 0
      s++
      if (s === SHELVES) {
        s = 0
        ends[c] = r
        c++
        starts[c] = r
      }
    }
    if (c >= caseDefs.length) throw new Error('not enough bookcases for the catalog')
    const h = 0.34 + (hashId(id, 12) % 8) * 0.016
    const d = 0.26 + (hashId(id, 13) % 5) * 0.016
    const face = caseDefs[c]
    const along = -USABLE / 2 + u + t / 2
    px[id] = face.cx + face.nx * (0.47 - d / 2)
    pz[id] = face.cz + face.az * along
    py[id] = boardTop(s) + h / 2
    bw[id] = t
    bh[id] = h
    bd[id] = d
    caseOf[id] = c
    shelfOf[id] = s
    u += t + 0.002
  }
  ends[c] = n
  const cases: CaseFace[] = caseDefs.map((def, i) => {
    const a = starts[i] ?? n
    const b = ends[i] ?? n
    const first = a < n ? BOOKS[orderByTitle[a]].title : ''
    const last = b > a ? BOOKS[orderByTitle[b - 1]].title : ''
    const cut = (t: string) => t.slice(0, 3).toUpperCase()
    return { ...def, start: a, end: b, label: b > a ? `${cut(first)} – ${cut(last)}` : 'EMPTY' }
  })
  return { px, py, pz, bw, bh, bd, caseOf, shelfOf, cases }
}

export const SHELVING = buildShelving()
export const CASES = SHELVING.cases

export function bookWorldPosition(id: number): [number, number, number] {
  return [SHELVING.px[id], SHELVING.py[id], SHELVING.pz[id]]
}
export function bookRotY(id: number): number {
  return caseDefs[SHELVING.caseOf[id]].rotY
}

/** pose that frames a book on its shelf */
export function poseForBook(id: number): Pose {
  const face = CASES[SHELVING.caseOf[id]]
  const bx = SHELVING.px[id]
  const by = SHELVING.py[id]
  const bz = SHELVING.pz[id]
  const sx = face.cx + face.nx * 2.3
  const sz = Math.max(ROOM.z0 + 3, Math.min(ROOM.z1 - 1.2, bz - face.az * 0.4))
  return lookAtPose(sx, sz, bx, by, bz, 55)
}

/* ------------------------------------------------------------ interactables -- */

export type IconName = 'librarian' | 'search' | 'algorithm' | 'about' | 'browse' | 'shelf'

export interface Interactable {
  id: string
  label: string
  prompt: string
  icon: IconName
  x: number
  z: number
  y: number
  radius: number
  stand: Pose
}

export const DESK = { x: 0, z: -11.1, top: 1.05 }
export const DESK_SPOT: [number, number, number] = [0.05, 1.1, -10.7]
export const LIBRARIAN_POS: [number, number, number] = [0, 0, -12.32]
export const ORRERY_POS = { x: 6, z: -3 }
export const PODIUM_POS = { x: 5.5, z: 5 }
export const GLOBE_POS = { x: -6.5, z: 5 }
export const CABINET_POS = { x: -8, z: -15.1 }
export const TABLES = [
  { x: -5, z: -1.5 },
  { x: -5, z: -6 },
]

export const INTERACTABLES: Interactable[] = [
  {
    id: 'librarian',
    label: 'Elara Quill, Head Librarian',
    prompt: 'Talk to the librarian',
    icon: 'librarian',
    x: DESK.x,
    z: DESK.z + 1,
    y: 2.35,
    radius: 5.4,
    stand: lookAtPose(0.15, -9.62, 0, 1.5, -12.32, 44),
  },
  {
    id: 'search',
    label: 'The Card Catalogue',
    prompt: 'Search by partial title',
    icon: 'search',
    x: CABINET_POS.x,
    z: CABINET_POS.z + 1.2,
    y: 2.0,
    radius: 3.6,
    stand: lookAtPose(CABINET_POS.x, -11.8, CABINET_POS.x, 1.0, CABINET_POS.z),
  },
  {
    id: 'algorithm',
    label: 'The Trie Orrery',
    prompt: 'Open the Algorithm Explorer',
    icon: 'algorithm',
    x: ORRERY_POS.x,
    z: ORRERY_POS.z,
    y: 3.0,
    radius: 3.4,
    stand: lookAtPose(ORRERY_POS.x - 0.4, ORRERY_POS.z + 3.4, ORRERY_POS.x, 1.9, ORRERY_POS.z),
  },
  {
    id: 'browse',
    label: 'The Great Index',
    prompt: 'Explore all 3,000 books',
    icon: 'browse',
    x: PODIUM_POS.x,
    z: PODIUM_POS.z,
    y: 2.0,
    radius: 3.2,
    stand: lookAtPose(PODIUM_POS.x, PODIUM_POS.z + 3, PODIUM_POS.x, 1.2, PODIUM_POS.z),
  },
  {
    id: 'about',
    label: 'The Globe & Plaque',
    prompt: 'About the project',
    icon: 'about',
    x: GLOBE_POS.x,
    z: GLOBE_POS.z,
    y: 2.4,
    radius: 3.2,
    stand: lookAtPose(GLOBE_POS.x, GLOBE_POS.z + 3, GLOBE_POS.x, 1.3, GLOBE_POS.z),
  },
]
for (const f of CASES) {
  const standX = f.cx + f.nx * 2.4
  INTERACTABLES.push({
    id: `case-${f.index}`,
    label: `Shelf ${f.index + 1}  ·  ${f.label}`,
    prompt: `Browse shelf ${f.index + 1} (${f.label})`,
    icon: 'shelf',
    x: f.cx + f.nx * 1.4,
    z: f.cz,
    y: CASE_H + 0.3,
    radius: 2.2,
    stand: lookAtPose(standX, f.cz, f.cx, 2.0, f.cz, 62),
  })
}
export function interactableById(id: string): Interactable | undefined {
  for (let i = 0; i < INTERACTABLES.length; i++) if (INTERACTABLES[i].id === id) return INTERACTABLES[i]
  return undefined
}

/* ---------------------------------------------------------------- collision -- */

export interface Box {
  x0: number
  x1: number
  z0: number
  z1: number
}
export const COLLIDERS: Box[] = [
  { x0: -2.5, x1: 2.5, z0: -12.7, z1: -9.95 }, // reception desk
  { x0: -3.1, x1: 3.1, z0: -16, z1: -12.7 }, // staff area
  { x0: -6.9, x1: -3.1, z0: -2.35, z1: -0.65 }, // reading table A
  { x0: -6.9, x1: -3.1, z0: -6.85, z1: -5.15 }, // reading table B
  { x0: ORRERY_POS.x - 0.95, x1: ORRERY_POS.x + 0.95, z0: ORRERY_POS.z - 0.95, z1: ORRERY_POS.z + 0.95 },
  { x0: PODIUM_POS.x - 0.6, x1: PODIUM_POS.x + 0.6, z0: PODIUM_POS.z - 0.6, z1: PODIUM_POS.z + 0.6 },
  { x0: GLOBE_POS.x - 0.7, x1: GLOBE_POS.x + 0.7, z0: GLOBE_POS.z - 0.7, z1: GLOBE_POS.z + 0.7 },
  { x0: CABINET_POS.x - 1.3, x1: CABINET_POS.x + 1.3, z0: -16, z1: CABINET_POS.z + 0.75 },
  { x0: 7.4, x1: 9.6, z0: -9.3, z1: -7.1 }, // reading nook armchair
]
export const BOUNDS = { x0: -11.0, x1: 11.0, z0: -15.2, z1: 11.2 }
