/* Local-storage helpers: user preferences + search history (never throws). */

export type Quality = 'low' | 'medium' | 'high'

export interface Prefs {
  mode: '2d' | '3d'
  quality: Quality
  sensitivity: number
  showHints: boolean
  reduceMotion: boolean
}

export interface HistoryEntry {
  prefix: string
  suffix: string
  /** result id or -1 */
  id: number
  count: number
  source: 'search' | 'librarian'
  at: number
}

const PREFS_KEY = 'library.prefs.v1'
const HISTORY_KEY = 'library.history.v1'

export function defaultMode(): '2d' | '3d' {
  if (typeof window === 'undefined') return '3d'
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return '2d'
  } catch {
    return '2d'
  }
  const small = window.matchMedia('(max-width: 767px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024
  return small || coarse ? '2d' : '3d'
}

export function defaultPrefs(): Prefs {
  return { mode: defaultMode(), quality: 'medium', sensitivity: 1, showHints: true, reduceMotion: false }
}

export function loadPrefs(): Prefs {
  const base = defaultPrefs()
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return base
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      mode: p.mode === '2d' || p.mode === '3d' ? p.mode : base.mode,
      quality: p.quality === 'low' || p.quality === 'medium' || p.quality === 'high' ? p.quality : base.quality,
      sensitivity: typeof p.sensitivity === 'number' ? Math.min(2.5, Math.max(0.3, p.sensitivity)) : base.sensitivity,
      showHints: typeof p.showHints === 'boolean' ? p.showHints : base.showHints,
      reduceMotion: typeof p.reduceMotion === 'boolean' ? p.reduceMotion : base.reduceMotion,
    }
  } catch {
    return base
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(list) ? list.slice(0, 30) : []
  } catch {
    return []
  }
}

export function saveHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)))
  } catch {
    /* storage unavailable */
  }
}
