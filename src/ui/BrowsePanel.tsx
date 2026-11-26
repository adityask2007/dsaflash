import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowDown01, BookOpen, Copy, Search, X } from 'lucide-react'
import { BOOKS, BOOK_COUNT, DUPLICATE_TITLE_COUNT, LETTERS, copiesOf, duplicateIds, idsForTitle, letterBuckets, normalizeClue, orderByTitle, rankByTitle, titleCase } from '../lib/catalog'
import { SHELVING } from '../lib/layout'
import { useLibrary, type ShelfFilter } from '../store'
import { BookCover, Chip, PanelShell, inputCls } from './common'

const ROW = 64
const ALL_IDS = Int32Array.from({ length: BOOK_COUNT }, (_, i) => i)

// contiguous rank range of every first letter inside the (one-time) title ordering
const letterRanges: { start: number; end: number }[] = LETTERS.map(() => ({ start: 0, end: 0 }))
{
  let prev = -1
  for (let r = 0; r < orderByTitle.length; r++) {
    const l = BOOKS[orderByTitle[r]].title.charCodeAt(0) - 97
    if (l !== prev) {
      if (prev >= 0) letterRanges[prev].end = r
      letterRanges[l].start = r
      prev = l
    }
  }
  letterRanges[prev].end = orderByTitle.length
}
const dupByTitle: number[] = []
for (let r = 0; r < orderByTitle.length; r++) if (copiesOf(orderByTitle[r]).length > 1) dupByTitle.push(orderByTitle[r])

type Sort = 'id' | 'title'

function computeList(q: string, letter: number | null, sort: Sort, dupOnly: boolean, shelf: ShelfFilter | null): ArrayLike<number> {
  const exact = normalizeClue(q)
  const active = (letter !== null ? 1 : 0) + (dupOnly ? 1 : 0) + (shelf ? 1 : 0)
  const passes = (id: number) => {
    if (letter !== null && BOOKS[id].title.charCodeAt(0) - 97 !== letter) return false
    if (dupOnly && copiesOf(id).length < 2) return false
    if (shelf) {
      const r = rankByTitle[id]
      if (r < shelf.start || r >= shelf.end) return false
    }
    return true
  }
  if (exact) {
    const base = idsForTitle(exact)
    const out: number[] = []
    for (let i = 0; i < base.length; i++) if (passes(base[i])) out.push(base[i])
    return out
  }
  let src: ArrayLike<number>
  let needPass = active > 1
  if (sort === 'title') {
    if (shelf) src = orderByTitle.subarray(shelf.start, shelf.end)
    else if (dupOnly) src = dupByTitle
    else if (letter !== null) src = orderByTitle.subarray(letterRanges[letter].start, letterRanges[letter].end)
    else src = orderByTitle
  } else {
    if (shelf) {
      const tmp = Array.from(orderByTitle.subarray(shelf.start, shelf.end))
      tmp.sort((a, b) => a - b)
      src = tmp
    } else if (dupOnly) src = duplicateIds
    else if (letter !== null) src = letterBuckets[letter]
    else src = ALL_IDS
  }
  if (!needPass) return src
  const out: number[] = []
  for (let i = 0; i < src.length; i++) if (passes(src[i])) out.push(src[i])
  needPass = false
  return out
}

export function BrowsePanel() {
  const close = useLibrary((s) => s.closePanel)
  const openDetail = useLibrary((s) => s.openDetail)
  const shelf = useLibrary((s) => s.shelfFilter)
  const setShelf = useLibrary((s) => s.setShelfFilter)
  const [q, setQ] = useState('')
  const [letter, setLetter] = useState<number | null>(null)
  const [sort, setSort] = useState<Sort>(shelf ? 'title' : 'id')
  const [dupOnly, setDupOnly] = useState(false)

  const list = useMemo(() => computeList(q, letter, sort, dupOnly, shelf), [q, letter, sort, dupOnly, shelf])

  // ---- windowing --------------------------------------------------------------
  const box = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewH(el.clientHeight))
    ro.observe(el)
    setViewH(el.clientHeight)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0
    setScrollTop(0)
  }, [list])

  const first = Math.max(0, Math.floor(scrollTop / ROW) - 4)
  const last = Math.min(list.length, Math.ceil((scrollTop + viewH) / ROW) + 4)
  const rows: React.ReactNode[] = []
  for (let i = first; i < last; i++) {
    const id = list[i]
    const b = BOOKS[id]
    const copies = copiesOf(id).length
    rows.push(
      <button
        key={id}
        onClick={() => openDetail(id)}
        style={{ position: 'absolute', top: i * ROW, left: 0, right: 0, height: ROW }}
        className="flex items-center gap-3 border-b border-white/5 px-4 text-left transition hover:bg-[#e3b866]/10"
      >
        <BookCover id={id} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-semibold leading-tight text-[#f6e7c3]">{titleCase(b.title)}</div>
          <div className="text-[11.5px] text-[#f1e4c8]/50">
            Shelf {SHELVING.caseOf[id] + 1} · row {SHELVING.shelfOf[id] + 1} · {b.title.length} {b.title.length === 1 ? 'letter' : 'letters'}
          </div>
        </div>
        {copies > 1 && (
          <Chip tone="teal">
            <Copy size={10} /> ×{copies}
          </Chip>
        )}
        <span className="w-16 shrink-0 text-right font-mono text-[13px] text-[#e3b866]">#{id}</span>
      </button>,
    )
  }

  return (
    <PanelShell title="Explore All Books" subtitle={`${BOOK_COUNT.toLocaleString()} titles · ${DUPLICATE_TITLE_COUNT} titles appear more than once`} icon={<BookOpen size={20} />} onClose={close} wide>
      <div className="flex h-full min-h-0 flex-col">
        <div className="space-y-3 border-b border-white/10 px-5 py-3.5">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#e3b866]/70" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by complete name, e.g. catdog" className={inputCls + ' !pl-10 !pr-9'} spellCheck={false} aria-label="Search by complete title" />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#f1e4c8]/60 hover:bg-white/10" aria-label="Clear search">
                <X size={15} />
              </button>
            )}
          </div>
          <div className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            <button onClick={() => setLetter(null)} className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${letter === null ? 'bg-[#e3b866] text-[#2a1a0c]' : 'bg-white/5 text-[#f1e4c8]/70 hover:bg-white/10'}`}>
              All
            </button>
            {LETTERS.map((l, i) => (
              <button
                key={l}
                title={`${letterBuckets[i].length} books`}
                onClick={() => setLetter(letter === i ? null : i)}
                className={`w-7 shrink-0 rounded-lg py-1 text-center text-xs font-semibold uppercase transition ${letter === i ? 'bg-[#e3b866] text-[#2a1a0c]' : 'bg-white/5 text-[#f1e4c8]/70 hover:bg-white/10'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-xl border border-[#e3b866]/25">
              <button onClick={() => setSort('id')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${sort === 'id' ? 'bg-[#e3b866] text-[#2a1a0c]' : 'text-[#f1e4c8]/75 hover:bg-white/10'}`}>
                <ArrowDown01 size={14} /> By ID
              </button>
              <button onClick={() => setSort('title')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${sort === 'title' ? 'bg-[#e3b866] text-[#2a1a0c]' : 'text-[#f1e4c8]/75 hover:bg-white/10'}`}>
                <ArrowDownAZ size={14} /> By title
              </button>
            </div>
            <button onClick={() => setDupOnly(!dupOnly)} className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${dupOnly ? 'border-[#6fd3c4] bg-[#6fd3c4]/15 text-[#8fe3d6]' : 'border-white/10 text-[#f1e4c8]/75 hover:bg-white/10'}`}>
              <Copy size={13} /> Duplicates only
            </button>
            {shelf && (
              <button onClick={() => setShelf(null)} className="flex items-center gap-1.5 rounded-xl border border-[#e3b866]/50 bg-[#e3b866]/15 px-3 py-1.5 text-xs font-medium text-[#f0cf86]">
                Shelf {shelf.caseIndex + 1} · {shelf.label} <X size={12} />
              </button>
            )}
            <span className="ml-auto text-xs text-[#f1e4c8]/50">
              {list.length.toLocaleString()} of {BOOK_COUNT.toLocaleString()} shown
            </span>
          </div>
        </div>

        <div ref={box} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="scroll-thin relative min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-[#f1e4c8]/60">
              <Search size={30} className="text-[#e3b866]/50" />
              <p className="font-display text-xl text-[#f6e7c3]">No book with that exact title</p>
              <p className="max-w-xs text-sm">This box looks for a complete name. For half-remembered titles, use “Search by Partial Title” or ask the librarian.</p>
            </div>
          ) : (
            <div style={{ height: list.length * ROW, position: 'relative' }}>{rows}</div>
          )}
        </div>
      </div>
    </PanelShell>
  )
}
