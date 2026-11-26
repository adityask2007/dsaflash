import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Box, Cpu, Home, Info, MessageCircle, Search, Settings, Undo2, UserRound } from 'lucide-react'
import { BOOKS, coverColor, titleCase } from '../lib/catalog'
import { WELCOME_LINE } from '../lib/librarian'
import { useLibrary } from '../store'
import { Avatar2D } from './Avatar2D'
import { BookCover, btnGhost, btnGold } from './common'

const CARDS = [
  { id: 'browse', title: 'Explore All Books', text: 'Browse, filter and sort 3,000 titles', icon: BookOpen },
  { id: 'search', title: 'Search by Partial Title', text: 'Prefix + suffix lookup', icon: Search },
  { id: 'algorithm', title: 'Algorithm Explorer', text: '2D Dual Trie & wrapped Trie visualizer', icon: Cpu },
  { id: 'about', title: 'About the Project', text: 'How it is built', icon: Info },
] as const

/** the 2D navigation interface (phones, low-power devices, no WebGL) */
export function Home2D() {
  const speaking = useLibrary((s) => s.librarian.speaking)
  const mood = useLibrary((s) => s.librarian.mood)
  const activate = useLibrary((s) => s.activate)
  const openPanel = useLibrary((s) => s.openPanel)
  const back = useLibrary((s) => s.backToWelcome)
  const setPrefs = useLibrary((s) => s.setPrefs)
  const deskId = useLibrary((s) => s.deskBookId)
  const openDetail = useLibrary((s) => s.openDetail)
  const returnBook = useLibrary((s) => s.returnBook)
  const clearDesk = useLibrary((s) => s.clearDeskBook)

  const spines: number[] = []
  for (let i = 0; i < 40; i++) spines.push(i * 53 + 7)

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto scroll-thin bg-[radial-gradient(ellipse_at_top,#3a2415_0%,#1a0f08_60%,#100905_100%)]">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
        <header className="flex items-center justify-between gap-2">
          <button onClick={back} className="glass-soft flex items-center gap-2 rounded-xl px-3 py-2">
            <Home size={16} className="text-[#e3b866]" />
            <span className="font-display text-lg font-bold tracking-[0.16em] text-[#f6e7c3]">THE LIBRARY</span>
          </button>
          <div className="flex gap-1.5">
            <button onClick={() => setPrefs({ mode: '3d' })} className={btnGhost + ' !px-3 !py-2 text-xs'}>
              <Box size={14} /> 3D
            </button>
            <button onClick={() => openPanel('settings')} className={btnGhost + ' !px-3 !py-2'} aria-label="Settings">
              <Settings size={16} />
            </button>
          </div>
        </header>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass mt-4 rounded-3xl p-5 text-center">
          <div className="mx-auto w-fit floaty">
            <Avatar2D speaking={speaking} mood={mood} size={150} />
          </div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e3b866]">Elara Quill · Head Librarian</div>
          <p className="mt-1 font-display text-2xl italic leading-snug text-[#f6e7c3]">“{WELCOME_LINE}”</p>
          <button onClick={() => activate('librarian')} className={btnGold + ' pulse-ring mt-4 w-full max-w-sm tracking-[0.18em]'}>
            <MessageCircle size={17} /> [ TALK TO LIBRARIAN ]
          </button>
        </motion.section>

        <AnimatePresence>
          {deskId !== null && (
            <motion.section initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="glass mt-3 flex items-center gap-4 rounded-2xl p-3.5">
              <BookCover id={deskId} size="md" animate />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e3b866]">On the librarian’s desk</div>
                <div className="truncate font-display text-3xl font-semibold text-[#f6e7c3]">{titleCase(BOOKS[deskId].title)}</div>
                <div className="text-xs text-[#f1e4c8]/55">Book ID {deskId}</div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => openDetail(deskId)} className={btnGhost + ' !px-3 !py-1.5 text-xs'}>
                    Details
                  </button>
                  <button onClick={() => { returnBook(); clearDesk() }} className={btnGhost + ' !px-3 !py-1.5 text-xs'}>
                    <Undo2 size={13} /> Return
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {CARDS.map((c, i) => (
            <motion.button key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }} onClick={() => activate(c.id)} className="glass-soft flex flex-col items-start rounded-2xl p-4 text-left transition active:scale-[0.98]">
              <span className="mb-2 grid h-10 w-10 place-items-center rounded-xl bg-[#e3b866]/12 text-[#e3b866]">
                <c.icon size={20} />
              </span>
              <span className="font-display text-lg font-semibold leading-tight text-[#f6e7c3]">{c.title}</span>
              <span className="mt-0.5 text-xs text-[#f1e4c8]/50">{c.text}</span>
            </motion.button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-[#f1e4c8]/55">
          <UserRound size={16} className="shrink-0 text-[#e3b866]" />
          You are in the lightweight 2D view. Tap <b className="text-[#f0cf86]">3D</b> to walk through the full library on a capable device.
        </div>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex h-16 items-end justify-center gap-[3px] overflow-hidden opacity-60" aria-hidden>
        {spines.map((id, i) => (
          <div key={i} className="shrink-0 rounded-t-[2px]" style={{ width: 10 + (id % 4) * 4, height: 30 + ((id * 7) % 34), background: coverColor(id) }} />
        ))}
      </div>
    </div>
  )
}
