import { motion } from 'framer-motion'
import { Copy, Crosshair, Hash, Library, Ruler, Truck, X } from 'lucide-react'
import { bringToDesk, showOnShelf } from '../actions'
import { BOOKS, copiesOf, titleCase, trie } from '../lib/catalog'
import { CASES, SHELVING } from '../lib/layout'
import { useLibrary } from '../store'
import { BookCover, Chip, btnGhost, btnGold } from './common'

export function BookDetail({ id }: { id: number }) {
  const openDetail = useLibrary((s) => s.openDetail)
  const deskBookId = useLibrary((s) => s.deskBookId)
  const returnBook = useLibrary((s) => s.returnBook)
  const mode = useLibrary((s) => s.prefs.mode)
  const book = BOOKS[id]
  const copies = copiesOf(id)
  const face = CASES[SHELVING.caseOf[id]]
  const p2 = book.title.slice(0, Math.min(2, book.title.length))
  const s2 = book.title.slice(Math.max(0, book.title.length - 2))
  const sharePrefix = trie.countMatches(p2, '')
  const shareSuffix = trie.countMatches('', s2)
  const sameBoth = trie.countMatches(p2, s2)
  const onDesk = deskBookId === id

  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => openDetail(null)}>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="glass relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl p-6 scroll-thin"
        role="dialog"
        aria-label={`Book details: ${book.title}`}
      >
        <button onClick={() => openDetail(null)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#f1e4c8]/70 hover:bg-white/10" aria-label="Close details">
          <X size={18} />
        </button>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <BookCover id={id} size="lg" animate />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e3b866]">Book details</div>
            <h3 className="font-display text-5xl font-bold leading-tight tracking-wide text-[#f6e7c3] break-all">{titleCase(book.title)}</h3>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Chip>
                <Hash size={11} /> ID {id}
              </Chip>
              <Chip tone="plain">
                <Ruler size={11} /> {book.title.length} {book.title.length === 1 ? 'letter' : 'letters'}
              </Chip>
              <Chip tone="plain">
                <Library size={11} /> Shelf {face.index + 1} · row {SHELVING.shelfOf[id] + 1}
              </Chip>
              {copies.length > 1 && (
                <Chip tone="teal">
                  <Copy size={11} /> {copies.length} copies
                </Chip>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#f1e4c8]/65">
              Catalogued {id === 0 ? 'first' : `as the ${id + 1}${suffixOf(id + 1)} book`} (insertion order). Shelved alphabetically in section <span className="font-semibold text-[#f0cf86]">{face.label}</span>.
            </p>
          </div>
        </div>

        {copies.length > 1 && (
          <div className="mt-5 rounded-2xl border border-[#6fd3c4]/25 bg-[#6fd3c4]/[0.06] p-3.5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8fe3d6]">Duplicate title · every copy has its own ID</div>
            <div className="flex flex-wrap gap-1.5">
              {copies.map((c) => (
                <button key={c} onClick={() => openDetail(c)} className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${c === id ? 'border-[#6fd3c4] bg-[#6fd3c4]/25 text-white' : 'border-white/15 text-[#f1e4c8]/75 hover:bg-white/10'}`}>
                  #{c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#f1e4c8]/55">The prefix–suffix search answers with the largest ID among identical titles (#{copies[copies.length - 1]} here).</p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { v: sharePrefix, l: `start with “${p2}”` },
            { v: shareSuffix, l: `end with “${s2}”` },
            { v: sameBoth, l: 'share both' },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-2.5">
              <div className="font-display text-2xl font-semibold text-[#f6e7c3]">{s.v}</div>
              <div className="text-[11px] leading-tight text-[#f1e4c8]/50">books {s.l}</div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-[#f1e4c8]/40">Counts come straight from the Trie (no scanning).</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => showOnShelf(id)} className={btnGold}>
            <Crosshair size={16} /> {mode === '2d' ? 'Show on shelf (3D)' : 'Show on shelf'}
          </button>
          {onDesk ? (
            <button onClick={() => { returnBook(); openDetail(null) }} className={btnGhost}>
              Return to shelf
            </button>
          ) : (
            <button onClick={() => { bringToDesk(id); openDetail(null) }} className={btnGhost}>
              <Truck size={16} /> Bring to librarian’s desk
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function suffixOf(n: number): string {
  const m100 = n % 100
  if (m100 >= 11 && m100 <= 13) return 'th'
  const m = n % 10
  return m === 1 ? 'st' : m === 2 ? 'nd' : m === 3 ? 'rd' : 'th'
}
