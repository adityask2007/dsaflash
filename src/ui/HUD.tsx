import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, ChevronDown, ChevronUp, Cpu, Home, Info, Keyboard, MessageCircle, MousePointerClick, Search, Settings, Undo2, UserRound, Layers } from 'lucide-react'
import { BOOKS, titleCase } from '../lib/catalog'
import { interactableById, type IconName } from '../lib/layout'
import { WELCOME_LINE } from '../lib/librarian'
import { useLibrary } from '../store'
import { BookCover, btnGhost, btnGold } from './common'

const ICONS: Record<IconName, typeof Search> = { librarian: UserRound, search: Search, algorithm: Cpu, about: Info, browse: BookOpen, shelf: Layers }

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-[#f6e7c3]">{children}</kbd>
}

function TopBar() {
  const goTo = useLibrary((s) => s.goTo)
  const openPanel = useLibrary((s) => s.openPanel)
  const back = useLibrary((s) => s.backToWelcome)
  const panel = useLibrary((s) => s.panel)
  const items: { id: string; label: string; icon: typeof Search; run: () => void; active: boolean }[] = [
    { id: 'browse', label: 'Browse all books', icon: BookOpen, run: () => goTo('browse'), active: panel === 'browse' },
    { id: 'search', label: 'Search by partial title', icon: Search, run: () => goTo('search'), active: panel === 'search' },
    { id: 'librarian', label: 'Librarian', icon: UserRound, run: () => goTo('librarian'), active: panel === 'librarian' },
    { id: 'algorithm', label: 'Algorithm Explorer', icon: Cpu, run: () => goTo('algorithm'), active: panel === 'algorithm' },
    { id: 'about', label: 'About', icon: Info, run: () => goTo('about'), active: panel === 'about' },
    { id: 'settings', label: 'Settings', icon: Settings, run: () => openPanel('settings'), active: panel === 'settings' },
  ]
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
      <button onClick={back} className="glass-soft pointer-events-auto flex items-center gap-2.5 rounded-2xl px-3.5 py-2 text-left transition hover:border-[#e3b866]/60">
        <Home size={16} className="text-[#e3b866]" />
        <span>
          <span className="block font-display text-lg font-bold leading-none tracking-[0.16em] text-[#f6e7c3]">THE LIBRARY</span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[#f1e4c8]/50 sm:block">Half-remembered titles</span>
        </span>
      </button>
      <div className="glass-soft pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={it.run}
            title={it.label}
            aria-label={it.label}
            className={`grid h-9 w-9 place-items-center rounded-xl transition sm:h-10 sm:w-10 ${it.active ? 'bg-[#e3b866] text-[#2a1a0c]' : 'text-[#f1e4c8]/80 hover:bg-white/10 hover:text-white'}`}
          >
            <it.icon size={18} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Prompt() {
  const nearby = useLibrary((s) => s.nearby)
  const panel = useLibrary((s) => s.panel)
  const openPanel = useLibrary((s) => s.openPanel)
  const activate = useLibrary((s) => s.activate)
  const it = nearby ? interactableById(nearby) : undefined
  const show = !!it && !panel
  const Icon = it ? ICONS[it.icon] : Search
  return (
    <AnimatePresence mode="wait">
      {show && it && it.id === 'librarian' && (
        <motion.div key="lib" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} className="glass pointer-events-auto absolute bottom-20 left-1/2 z-10 w-[min(92vw,430px)] -translate-x-1/2 rounded-3xl p-4 text-center sm:bottom-8">
          <div className="mb-1 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e3b866]">
            <MessageCircle size={13} /> Elara Quill · Head Librarian
          </div>
          <p className="font-display text-2xl italic leading-snug text-[#f6e7c3]">“{WELCOME_LINE}”</p>
          <button onClick={() => openPanel('librarian')} className={`${btnGold} pulse-ring mt-3 w-full tracking-[0.18em]`}>
            [ TALK TO LIBRARIAN ]
          </button>
          <div className="mt-2 text-[11px] text-[#f1e4c8]/50">
            or press <Kbd>E</Kbd>
          </div>
        </motion.div>
      )}
      {show && it && it.id !== 'librarian' && (
        <motion.button
          key={it.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={() => activate(it.id)}
          className="glass pointer-events-auto absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:border-[#e3b866]/70 sm:bottom-8"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3b866] text-[#2a1a0c]">
            <Icon size={20} />
          </span>
          <span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e3b866]">{it.label}</span>
            <span className="block text-[15px] font-medium text-[#f6e7c3]">
              <Kbd>E</Kbd> <span className="ml-1">{it.prompt}</span>
            </span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

function DeskCard() {
  const id = useLibrary((s) => s.deskBookId)
  const openDetail = useLibrary((s) => s.openDetail)
  const returnBook = useLibrary((s) => s.returnBook)
  return (
    <AnimatePresence>
      {id !== null && (
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="glass pointer-events-auto absolute bottom-24 right-3 z-10 flex w-[min(92vw,310px)] items-center gap-3 rounded-2xl p-3 sm:bottom-4 sm:right-4">
          <BookCover id={id} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e3b866]">On the librarian’s desk</div>
            <div className="truncate font-display text-xl font-semibold text-[#f6e7c3]">{titleCase(BOOKS[id].title)}</div>
            <div className="text-[11px] text-[#f1e4c8]/55">Book ID {id}</div>
            <div className="mt-1.5 flex gap-1.5">
              <button onClick={() => openDetail(id)} className={btnGhost + ' !px-2.5 !py-1 text-xs'}>
                Details
              </button>
              <button onClick={returnBook} className={btnGhost + ' !px-2.5 !py-1 text-xs'}>
                <Undo2 size={12} /> Return
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Hints() {
  const show = useLibrary((s) => s.prefs.showHints)
  const setPrefs = useLibrary((s) => s.setPrefs)
  const [open, setOpen] = useState(true)
  if (!show) return null
  return (
    <div className="glass-soft pointer-events-auto absolute bottom-4 left-3 z-10 hidden max-w-[300px] rounded-2xl p-3 text-[12px] text-[#f1e4c8]/75 lg:block lg:left-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e3b866]">
        <span className="flex items-center gap-1.5">
          <Keyboard size={13} /> Controls
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          <li>
            <Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd> move · <Kbd>Shift</Kbd> run
          </li>
          <li>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> walk · <Kbd>←</Kbd> <Kbd>→</Kbd> turn
          </li>
          <li className="flex items-center gap-1.5">
            <MousePointerClick size={13} /> drag to look · scroll to zoom
          </li>
          <li>
            Click shelves, books and objects · <Kbd>E</Kbd> interact
          </li>
          <li>
            <Kbd>Esc</Kbd> close panels
          </li>
        </ul>
      )}
      {open && (
        <button onClick={() => setPrefs({ showHints: false })} className="mt-2 text-[11px] text-[#f1e4c8]/45 underline-offset-2 hover:underline">
          hide hints
        </button>
      )}
    </div>
  )
}

function HoverTip() {
  const id = useLibrary((s) => s.hoverBookId)
  if (id === null) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full border border-[#e3b866]/40 bg-black/70 px-4 py-1.5 text-sm text-[#f6e7c3] backdrop-blur">
      <span className="font-display text-lg font-semibold">{titleCase(BOOKS[id].title)}</span>
      <span className="ml-2 text-xs text-[#e3b866]">ID {id}</span>
      <span className="ml-2 text-[11px] text-[#f1e4c8]/50">click for details</span>
    </div>
  )
}

function DPad() {
  const set = useLibrary((s) => s.setVirtualKey)
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  if (!coarse) return null
  const btn = (key: string, icon: React.ReactNode, cls: string) => (
    <button
      className={`pointer-events-auto grid h-12 w-12 select-none place-items-center rounded-2xl border border-[#e3b866]/30 bg-black/50 text-[#f6e7c3] backdrop-blur active:bg-[#e3b866]/40 ${cls}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(key, true)
      }}
      onPointerUp={() => set(key, false)}
      onPointerCancel={() => set(key, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {icon}
    </button>
  )
  return (
    <div className="absolute bottom-4 left-3 z-10 grid grid-cols-3 gap-1.5">
      <span />
      {btn('fwd', <ArrowUp size={20} />, '')}
      <span />
      {btn('turnL', <ArrowLeft size={20} />, '')}
      {btn('back', <ArrowDown size={20} />, '')}
      {btn('turnR', <ArrowRight size={20} />, '')}
    </div>
  )
}

export function HUD() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <TopBar />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f6e7c3]/50 shadow-[0_0_6px_rgba(255,230,170,0.6)]" />
      <HoverTip />
      <Prompt />
      <DeskCard />
      <Hints />
      <DPad />
    </div>
  )
}

