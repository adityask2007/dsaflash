import { create } from 'zustand'
import { CASES, SPAWN, interactableById, type Pose } from './lib/layout'
import type { Gesture, Mood } from './lib/librarian'
import { loadHistory, loadPrefs, saveHistory, savePrefs, type HistoryEntry, type Prefs } from './lib/storage'

export type PanelId = 'browse' | 'search' | 'librarian' | 'algorithm' | 'about' | 'settings'

export interface ShelfFilter {
  caseIndex: number
  label: string
  start: number
  end: number
}

export interface Tween {
  nonce: number
  pose: Pose
  duration: number
  then?: () => void
}

interface LibraryState {
  view: 'welcome' | 'library'
  prefs: Prefs
  panel: PanelId | null
  detailId: number | null
  shelfFilter: ShelfFilter | null
  nearby: string | null
  nearLibrarian: boolean
  nearShelves: boolean
  hoverBookId: number | null
  highlightId: number | null
  deskBookId: number | null
  deliverNonce: number
  returnNonce: number
  tween: Tween | null
  librarian: { speaking: boolean; mood: Mood; gesture: Gesture | null; gestureNonce: number }
  history: HistoryEntry[]
  virtualKeys: Record<string, boolean>
  locked: boolean

  enterLibrary: (pose?: Pose, then?: () => void) => void
  backToWelcome: () => void
  openPanel: (p: PanelId) => void
  closePanel: () => void
  openDetail: (id: number | null) => void
  setShelfFilter: (f: ShelfFilter | null) => void
  setPrefs: (p: Partial<Prefs>) => void
  setNearby: (id: string | null) => void
  setNearLibrarian: (v: boolean) => void
  setNearShelves: (v: boolean) => void
  setHoverBook: (id: number | null) => void
  flyTo: (pose: Pose, duration?: number, then?: () => void) => void
  clearTween: () => void
  activate: (id: string) => void
  goTo: (id: string) => void
  highlight: (id: number | null) => void
  deliverBook: (id: number) => void
  returnBook: () => void
  clearDeskBook: () => void
  setSpeaking: (v: boolean) => void
  setMood: (m: Mood) => void
  gesture: (g: Gesture) => void
  addHistory: (e: Omit<HistoryEntry, 'at'>) => void
  clearHistory: () => void
  setVirtualKey: (k: string, down: boolean) => void
  setLocked: (v: boolean) => void
}

let tweenCounter = 0

export const useLibrary = create<LibraryState>((set, get) => ({
  view: 'welcome',
  prefs: loadPrefs(),
  panel: null,
  detailId: null,
  shelfFilter: null,
  nearby: null,
  nearLibrarian: false,
  nearShelves: false,
  hoverBookId: null,
  highlightId: null,
  deskBookId: null,
  deliverNonce: 0,
  returnNonce: 0,
  tween: null,
  librarian: { speaking: false, mood: 'happy', gesture: null, gestureNonce: 0 },
  history: loadHistory(),
  virtualKeys: {},
  locked: false,

  enterLibrary: (pose, then) => {
    set({ view: 'library' })
    const target = pose ?? SPAWN
    get().flyTo(target, 2.6, then)
  },
  backToWelcome: () => set({ view: 'welcome', panel: null, detailId: null }),
  openPanel: (p) => set({ panel: p }),
  closePanel: () => set({ panel: null, detailId: null }),
  openDetail: (id) => set({ detailId: id }),
  setShelfFilter: (f) => set({ shelfFilter: f }),
  setPrefs: (p) => {
    const prefs = { ...get().prefs, ...p }
    savePrefs(prefs)
    set({ prefs })
  },
  setNearby: (id) => {
    if (get().nearby !== id) set({ nearby: id })
  },
  setNearLibrarian: (v) => {
    if (get().nearLibrarian !== v) set({ nearLibrarian: v })
  },
  setNearShelves: (v) => {
    if (get().nearShelves !== v) set({ nearShelves: v })
  },
  setHoverBook: (id) => {
    if (get().hoverBookId !== id) set({ hoverBookId: id })
  },
  flyTo: (pose, duration = 2.2, then) => set({ tween: { nonce: ++tweenCounter, pose, duration, then } }),
  clearTween: () => set({ tween: null }),
  activate: (id) => {
    if (id === 'librarian') set({ panel: 'librarian' })
    else if (id === 'search') set({ panel: 'search' })
    else if (id === 'algorithm') set({ panel: 'algorithm' })
    else if (id === 'about') set({ panel: 'about' })
    else if (id === 'browse') set({ panel: 'browse', shelfFilter: null })
    else if (id.startsWith('case-')) {
      const c = CASES[Number(id.slice(5))]
      if (c) set({ panel: 'browse', shelfFilter: { caseIndex: c.index, label: c.label, start: c.start, end: c.end } })
    }
  },
  goTo: (id) => {
    const it = interactableById(id)
    if (!it) return
    if (get().prefs.mode === '2d' || get().view === 'welcome') {
      get().activate(id)
      return
    }
    set({ panel: null })
    get().flyTo(it.stand, 1.8, () => get().activate(id))
  },
  highlight: (id) => set({ highlightId: id }),
  deliverBook: (id) => set((s) => ({ deskBookId: id, deliverNonce: s.deliverNonce + 1, highlightId: null })),
  returnBook: () => set((s) => ({ returnNonce: s.returnNonce + 1 })),
  clearDeskBook: () => set({ deskBookId: null }),
  setSpeaking: (v) => {
    if (get().librarian.speaking !== v) set((s) => ({ librarian: { ...s.librarian, speaking: v } }))
  },
  setMood: (m) => set((s) => ({ librarian: { ...s.librarian, mood: m } })),
  gesture: (g) => set((s) => ({ librarian: { ...s.librarian, gesture: g, gestureNonce: s.librarian.gestureNonce + 1 } })),
  addHistory: (e) => {
    const history = [{ ...e, at: Date.now() }, ...get().history].slice(0, 30)
    saveHistory(history)
    set({ history })
  },
  clearHistory: () => {
    saveHistory([])
    set({ history: [] })
  },
  setVirtualKey: (k, down) => set((s) => ({ virtualKeys: { ...s.virtualKeys, [k]: down } })),
  setLocked: (v) => set({ locked: v }),
}))
