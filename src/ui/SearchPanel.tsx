import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, History, Search, Sparkles, Trash2, Truck } from 'lucide-react'
import { bringToDesk, showOnShelf } from '../actions'
import { BOOKS, normalizeClue, searchBooks, titleCase, trie } from '../lib/catalog'
import { useLibrary } from '../store'
import { BookCover, Chip, HighlightedTitle, PanelShell, btnGhost, btnGold, inputCls } from './common'
import { TraceLegend, TraceView } from './TraceView'

const EXAMPLES: { p: string; s: string; note: string }[] = [
  { p: 'cat', s: 'og', note: 'several matches' },
  { p: 'ec', s: 'ho', note: 'duplicate titles' },
  { p: 's', s: 'e', note: 'many matches' },
  { p: 'pa', s: 'er', note: '' },
  { p: 'dog', s: 'cat', note: 'no match' },
  { p: 'zq', s: 'x', note: 'no match' },
]

export function SearchPanel() {
  const close = useLibrary((s) => s.closePanel)
  const openDetail = useLibrary((s) => s.openDetail)
  const history = useLibrary((s) => s.history)
  const addHistory = useLibrary((s) => s.addHistory)
  const clearHistory = useLibrary((s) => s.clearHistory)
  const deskBookId = useLibrary((s) => s.deskBookId)
  const mode = useLibrary((s) => s.prefs.mode)

  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [shown, setShown] = useState(12)
  const lastCommit = useRef('')

  const outcome = useMemo(() => (prefix || suffix ? searchBooks(prefix, suffix, shown) : null), [prefix, suffix, shown])

  const commit = (p: string, s: string) => {
    const key = p + '|' + s
    if ((!p && !s) || lastCommit.current === key) return
    lastCommit.current = key
    const o = searchBooks(p, s, 1)
    addHistory({ prefix: p, suffix: s, id: o.id, count: o.count, source: 'search' })
  }

  // record a search in the history once the visitor stops typing
  useEffect(() => {
    if (!prefix && !suffix) return
    const t = setTimeout(() => commit(prefix, suffix), 1400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, suffix])

  const run = (p: string, s: string) => {
    setPrefix(p)
    setSuffix(s)
    setShown(12)
    commit(p, s)
  }

  const prefixOnly = outcome && prefix ? trie.countMatches(outcome.prefix, '') : 0
  const suffixOnly = outcome && suffix ? trie.countMatches('', outcome.suffix) : 0
  const best = outcome && outcome.id >= 0 ? outcome.id : -1

  return (
    <PanelShell title="Search by Partial Title" subtitle="Give the beginning and the ending. The Trie does the rest." icon={<Search size={20} />} onClose={close} wide>
      <div className="scroll-thin h-full overflow-y-auto px-5 pb-8 pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            commit(prefix, suffix)
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#f0cf86]">
              <span className="h-2 w-2 rounded-sm bg-[#e3b866]" /> Starts with (prefix)
            </span>
            <input value={prefix} onChange={(e) => { setPrefix(normalizeClue(e.target.value).slice(0, 12)); setShown(12) }} placeholder="e.g. cat" className={inputCls + ' font-mono text-lg tracking-widest'} spellCheck={false} autoComplete="off" autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8fe3d6]">
              <span className="h-2 w-2 rounded-sm bg-[#6fd3c4]" /> Ends with (suffix)
            </span>
            <input value={suffix} onChange={(e) => { setSuffix(normalizeClue(e.target.value).slice(0, 12)); setShown(12) }} placeholder="e.g. og" className={inputCls + ' font-mono text-lg tracking-widest'} spellCheck={false} autoComplete="off" />
          </label>
        </form>
        <p className="mt-2 text-xs text-[#f1e4c8]/45">Letters only, lowercase. Leave one box empty to match anything on that side.</p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-xs text-[#f1e4c8]/55">
            <Sparkles size={13} className="text-[#e3b866]" /> Try:
          </span>
          {EXAMPLES.map((x) => (
            <button key={x.p + x.s} onClick={() => run(x.p, x.s)} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-[#f1e4c8]/85 transition hover:border-[#e3b866]/60 hover:bg-[#e3b866]/10">
              <span className="font-mono text-[#f0cf86]">{x.p}</span>
              <span className="mx-1 text-[#f1e4c8]/40">…</span>
              <span className="font-mono text-[#8fe3d6]">{x.s}</span>
              {x.note && <span className="ml-1.5 text-[10px] text-[#f1e4c8]/40">{x.note}</span>}
            </button>
          ))}
        </div>

        {!outcome && (
          <div className="mt-8 rounded-2xl border border-dashed border-[#e3b866]/25 p-8 text-center text-[#f1e4c8]/55">
            <Search size={34} className="mx-auto mb-3 text-[#e3b866]/60" />
            <p className="font-display text-xl text-[#f6e7c3]">What do you remember?</p>
            <p className="mx-auto mt-1 max-w-sm text-sm">Type the first letters and the last letters of the title you half remember. Results appear as you type.</p>
          </div>
        )}

        {outcome && (
          <motion.div key={outcome.prefix + '|' + outcome.suffix} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            {best >= 0 ? (
              <div className="rounded-2xl border border-[#e3b866]/35 bg-gradient-to-br from-[#e3b866]/12 to-transparent p-4">
                <div className="flex items-center gap-4">
                  <BookCover id={best} size="md" animate />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e3b866]">Best match · largest ID</div>
                    <div className="truncate text-4xl font-semibold leading-tight">
                      <HighlightedTitle title={BOOKS[best].title} prefix={outcome.prefix} suffix={outcome.suffix} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Chip>ID {best}</Chip>
                      <Chip tone="plain">
                        {outcome.count} {outcome.count === 1 ? 'match' : 'matches'}
                      </Chip>
                      <Chip tone="plain">{outcome.micros < 1000 ? `${outcome.micros.toFixed(0)} µs` : `${(outcome.micros / 1000).toFixed(2)} ms`}</Chip>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#f1e4c8]/70">
                  {outcome.prefix ? (
                    <>
                      It begins with “<b className="text-[#f0cf86]">{outcome.prefix}</b>”
                    </>
                  ) : (
                    'Any beginning'
                  )}
                  {outcome.prefix && outcome.suffix ? ' and ends with ' : outcome.suffix ? ', ends with ' : ''}
                  {outcome.suffix ? (
                    <>
                      “<b className="text-[#8fe3d6]">{outcome.suffix}</b>”
                    </>
                  ) : null}
                  .{outcome.count > 1 ? ` ${outcome.count} books fit; the highest ID wins the tie-break.` : ' It is the only book that fits.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => openDetail(best)} className={btnGold}>
                    View details
                  </button>
                  <button onClick={() => showOnShelf(best)} className={btnGhost}>
                    <Crosshair size={15} /> {mode === '2d' ? 'Show on shelf (3D)' : 'Show on shelf'}
                  </button>
                  <button onClick={() => bringToDesk(best)} className={btnGhost} disabled={deskBookId === best}>
                    <Truck size={15} /> {deskBookId === best ? 'On the desk' : 'Bring to desk'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.07] p-4">
                <div className="font-display text-2xl font-semibold text-[#f6e7c3]">No book matches both clues</div>
                <p className="mt-1.5 text-sm leading-relaxed text-[#f1e4c8]/70">
                  {prefix ? (prefixOnly > 0 ? `${prefixOnly} book${prefixOnly === 1 ? '' : 's'} start with “${outcome.prefix}”` : `No book starts with “${outcome.prefix}”`) : ''}
                  {prefix && suffix ? ', and ' : ''}
                  {suffix ? (suffixOnly > 0 ? `${suffixOnly} book${suffixOnly === 1 ? '' : 's'} end with “${outcome.suffix}”` : `no book ends with “${outcome.suffix}”`) : ''}
                  {prefixOnly > 0 && suffixOnly > 0 ? ', but never in the same title.' : '.'} Try fewer letters, or check the spelling.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e3b866]">Trie walk · key “{outcome.trace.key}”</div>
                <div className="text-[11px] text-[#f1e4c8]/45">
                  {outcome.trace.edgesWalked}/{outcome.trace.steps.length} edges
                </div>
              </div>
              <TraceView trace={outcome.trace} />
              <div className="mt-2">
                <TraceLegend />
              </div>
            </div>

            {outcome.count > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold text-[#f6e7c3]">All matches ({outcome.count})</h3>
                  <span className="text-[11px] text-[#f1e4c8]/45">descending ID</span>
                </div>
                <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
                  {outcome.matches.map((id, i) => (
                    <li key={id}>
                      <button onClick={() => openDetail(id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-[#e3b866]/10">
                        <BookCover id={id} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-2xl">
                          <HighlightedTitle title={BOOKS[id].title} prefix={outcome.prefix} suffix={outcome.suffix} />
                        </span>
                        {i === 0 && <Chip>largest ID</Chip>}
                        <span className="font-mono text-[13px] text-[#e3b866]">#{id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {outcome.count > outcome.matches.length && (
                  <button onClick={() => setShown(shown + 25)} className={btnGhost + ' mt-2 w-full'}>
                    Show more ({outcome.count - outcome.matches.length} remaining)
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-[#f6e7c3]">
              <History size={17} className="text-[#e3b866]" /> Search history
            </h3>
            {history.length > 0 && (
              <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-[#f1e4c8]/50 hover:text-red-300">
                <Trash2 size={12} /> clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-[#f1e4c8]/40">Your searches are remembered here (stored in your browser only).</p>
          ) : (
            <ul className="space-y-1.5">
              {history.slice(0, 8).map((h) => (
                <li key={h.at}>
                  <button onClick={() => run(h.prefix, h.suffix)} className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm transition hover:border-[#e3b866]/40 hover:bg-[#e3b866]/8">
                    <span className="font-mono text-[#f0cf86]">{h.prefix || '*'}</span>
                    <span className="text-[#f1e4c8]/35">…</span>
                    <span className="font-mono text-[#8fe3d6]">{h.suffix || '*'}</span>
                    <span className="ml-auto text-xs text-[#f1e4c8]/55">{h.id >= 0 ? `${titleCase(BOOKS[h.id].title)} · #${h.id}` : 'no match'}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#f1e4c8]/40">{h.source}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PanelShell>
  )
}
