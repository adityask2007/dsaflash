import { create } from 'zustand'
import { initialDialog, type DialogState, type Mood, type ResultCard } from './lib/librarian'

export interface ChatMessage {
  id: number
  role: 'librarian' | 'user' | 'card'
  text: string
  mood?: Mood
  card?: ResultCard
  /** timestamp used by the typewriter effect */
  at: number
}

interface ChatState {
  messages: ChatMessage[]
  dialog: DialogState
  busy: boolean
  started: boolean
  push: (m: Omit<ChatMessage, 'id' | 'at'>) => number
  setDialog: (d: DialogState) => void
  setBusy: (b: boolean) => void
  setStarted: (b: boolean) => void
  reset: () => void
  revealAll: () => void
}

let counter = 0

export const useChat = create<ChatState>((set, get) => ({
  messages: [],
  dialog: { ...initialDialog },
  busy: false,
  started: false,
  push: (m) => {
    const id = ++counter
    set({ messages: [...get().messages, { ...m, id, at: performance.now() }] })
    return id
  },
  setDialog: (dialog) => set({ dialog }),
  setBusy: (busy) => set({ busy }),
  setStarted: (started) => set({ started }),
  reset: () => set({ messages: [], dialog: { ...initialDialog }, busy: false, started: false }),
  revealAll: () => set({ messages: get().messages.map((m) => ({ ...m, at: -1e9 })) }),
}))
