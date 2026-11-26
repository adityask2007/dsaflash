import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Box, Cpu, Info, Layers, Search, UserRound } from 'lucide-react'
import { navigate, type NavOption } from '../actions'
import { BOOK_COUNT, coverColor } from '../lib/catalog'
import { useLibrary } from '../store'

const OPTIONS: { id: NavOption; title: string; text: string; icon: typeof Search }[] = [
  { id: 'browse', title: 'Explore All Books', text: 'Browse, filter and sort all 3,000 titles', icon: BookOpen },
  { id: 'librarian', title: 'Meet the Librarian', text: 'Elara Quill finds a book from two clues', icon: UserRound },
  { id: 'search', title: 'Search by Partial Title', text: 'Prefix + suffix lookup, instantly', icon: Search },
  { id: 'algorithm', title: 'Algorithm Explorer', text: '2D Dual Trie, two-pointer & wrapped Trie visualizer', icon: Cpu },
  { id: 'about', title: 'About the Project', text: 'Design, data rules and architecture', icon: Info },
]

function SpineStrip() {
  const spines: number[] = []
  for (let i = 0; i < 70; i++) spines.push(i * 37 + 11)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-40 items-end justify-center gap-[3px] overflow-hidden opacity-70" aria-hidden>
      {spines.map((id, i) => (
        <div key={i} className="shrink-0 rounded-t-[2px] shadow-[inset_-2px_0_3px_rgba(0,0,0,0.4)]" style={{ width: 14 + (id % 5) * 4, height: 80 + ((id * 7) % 70), background: coverColor(id) }}>
          <div className="mx-auto mt-3 h-px w-[70%] bg-[#e3b866]/60" />
        </div>
      ))}
    </div>
  )
}

export function Welcome() {
  const mode = useLibrary((s) => s.prefs.mode)
  const setPrefs = useLibrary((s) => s.setPrefs)
  const is2d = mode === '2d'

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto scroll-thin">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(18,11,6,0.35)_0%,rgba(18,11,6,0.82)_70%,rgba(10,6,3,0.96)_100%)]" />
      {is2d && <SpineStrip />}
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center px-5 py-10 text-center">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="flex flex-col items-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e3b866]/30 bg-black/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#e3b866]">
            <Layers size={13} /> Trie-powered digital library
          </div>
          <h1 className="font-display text-6xl font-bold leading-none tracking-[0.12em] sm:text-8xl">
            <span className="gold-text">THE LIBRARY</span>
          </h1>
          <div className="mt-4 flex items-center gap-4">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#e3b866]/70 sm:w-24" />
            <p className="font-display text-xl italic tracking-wide text-[#f1e4c8]/90 sm:text-3xl">The Library’s Half-Remembered Titles</p>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#e3b866]/70 sm:w-24" />
          </div>
          <p className="mt-5 max-w-2xl text-balance text-[15px] leading-relaxed text-[#f1e4c8]/75">
            You remember how a book starts and how it ends, but not the whole name. Walk through {BOOK_COUNT.toLocaleString()} shelved books, ask the librarian, or watch a hand-built prefix–suffix Trie find it in
            microseconds.
          </p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('enter')}
          className="pulse-ring mt-8 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-b from-[#f4d68f] to-[#b98a3e] px-9 py-4 font-display text-xl font-bold tracking-[0.2em] text-[#2a1a0c] shadow-[0_10px_40px_rgba(185,138,62,0.45)]"
        >
          ENTER LIBRARY <ArrowRight size={22} />
        </motion.button>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.55 } } }}
          className="mt-9 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {OPTIONS.map((o) => (
            <motion.button
              key={o.id}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              onClick={() => navigate(o.id)}
              className="glass-soft group flex flex-col items-start rounded-2xl p-4 text-left transition hover:border-[#e3b866]/60 hover:bg-[#2a1a0e]/80"
            >
              <span className="mb-2.5 grid h-10 w-10 place-items-center rounded-xl bg-[#e3b866]/12 text-[#e3b866] transition group-hover:bg-[#e3b866] group-hover:text-[#2a1a0c]">
                <o.icon size={20} />
              </span>
              <span className="font-display text-[19px] font-semibold leading-tight text-[#f6e7c3]">{o.title}</span>
              <span className="mt-1 text-[12.5px] leading-snug text-[#f1e4c8]/55">{o.text}</span>
            </motion.button>
          ))}
        </motion.div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[12px] text-[#f1e4c8]/60">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">{BOOK_COUNT.toLocaleString()} books · IDs 0–{BOOK_COUNT - 1}</span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">Query time O(|prefix| + |suffix|)</span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">No external APIs</span>
          <button
            onClick={() => setPrefs({ mode: is2d ? '3d' : '2d' })}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#e3b866]/40 bg-[#e3b866]/10 px-3 py-1 font-medium text-[#f0cf86] transition hover:bg-[#e3b866]/20"
          >
            <Box size={13} /> Experience: {is2d ? '2D mobile-friendly' : 'Immersive 3D'} · switch
          </button>
        </div>
      </div>
    </div>
  )
}
