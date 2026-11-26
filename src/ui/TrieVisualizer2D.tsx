import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Cpu,
  GitBranch,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  SkipForward,
  Sparkles,
  Trash2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { normalizeClue, titleCase } from '../lib/catalog'
import { bruteForceCount, bruteForceLargestId, startsWithAt } from '../lib/bruteforce'
import { PrefixSuffixTrie, type InspectedNode, type InspectedTrie, type InsertEdgeTrace } from '../lib/trie'
import { DualTrieVisualizer2D } from './DualTrieVisualizer2D'
import { btnGhost, btnGold, inputCls } from './common'

/* ============================================================================
 *  2D Interactive Trie Tree Visualizer & Evaluator Walkthrough
 *  Backed directly by the real PrefixSuffixTrie class (no fake tree data).
 * ========================================================================== */

interface Preset {
  id: string
  label: string
  note: string
  words: string[]
  prefix: string
  suffix: string
}

const PRESETS: Preset[] = [
  {
    id: 'starter',
    label: 'Simple 3-Word Starter',
    note: 'Easiest to trace by hand on a board',
    words: ['cat', 'rat', 'car'],
    prefix: 'c',
    suffix: 'at',
  },
  {
    id: 'flagship',
    label: 'Flagship (cat + og)',
    note: 'Shows largest-ID tie-break (catdog #3 wins)',
    words: ['catfog', 'catlog', 'catalog', 'catdog'],
    prefix: 'cat',
    suffix: 'og',
  },
  {
    id: 'duplicates',
    label: 'Duplicates & Tie-Break',
    note: 'Same title "echo" gets IDs #0 and #2',
    words: ['echo', 'hero', 'echo', 'halo'],
    prefix: 'e',
    suffix: 'o',
  },
  {
    id: 'overlap',
    label: 'Overlapping Clues',
    note: 'Prefix "st" + suffix "art" overlap in "start"',
    words: ['star', 'start', 'tart', 'art'],
    prefix: 'st',
    suffix: 'art',
  },
]

type ModeTab = 'dual' | 'query' | 'insert' | 'compare'

interface NodePos {
  x: number
  y: number
  node: InspectedNode
}

interface LayoutResult {
  positions: Map<number, NodePos>
  width: number
  height: number
}

function layoutTrie(inspected: InspectedTrie): LayoutResult {
  const byId = new Map<number, InspectedNode>()
  for (const n of inspected.nodes) byId.set(n.id, n)

  const leafWidth = new Map<number, number>()
  const measure = (id: number): number => {
    const n = byId.get(id)
    if (!n || n.edges.length === 0) {
      leafWidth.set(id, 1)
      return 1
    }
    let sum = 0
    for (const e of n.edges) {
      if (byId.has(e.to)) sum += measure(e.to)
    }
    const w = Math.max(1, sum)
    leafWidth.set(id, w)
    return w
  }
  const totalLeaves = measure(0)

  const COL_W = 58
  const ROW_H = 88
  const PAD_X = 48
  const PAD_Y = 44

  let maxDepth = 0
  const positions = new Map<number, NodePos>()

  const place = (id: number, xStart: number, spanUnits: number) => {
    const n = byId.get(id)
    if (!n) return
    if (n.depth > maxDepth) maxDepth = n.depth
    const cx = PAD_X + (xStart + spanUnits / 2) * COL_W
    const cy = PAD_Y + n.depth * ROW_H
    positions.set(id, { x: cx, y: cy, node: n })

    let cursor = xStart
    for (const e of n.edges) {
      if (!byId.has(e.to)) continue
      const w = leafWidth.get(e.to) ?? 1
      place(e.to, cursor, w)
      cursor += w
    }
  }
  place(0, 0, totalLeaves)

  return {
    positions,
    width: Math.max(620, totalLeaves * COL_W + PAD_X * 2),
    height: Math.max(360, (maxDepth + 1) * ROW_H + PAD_Y * 2),
  }
}

interface InsertKeyStep {
  wordIndex: number
  word: string
  start: number
  key: string
}

export function TrieVisualizer2D({ expanded = false }: { expanded?: boolean }) {
  const [presetId, setPresetId] = useState<string>('flagship')
  const [words, setWords] = useState<string[]>(PRESETS[1].words)
  const [newWord, setNewWord] = useState('')
  const [prefix, setPrefix] = useState(PRESETS[1].prefix)
  const [suffix, setSuffix] = useState(PRESETS[1].suffix)
  const [tab, setTab] = useState<ModeTab>('dual')
  const fullCatalog = presetId === 'full3000'

  // Query walkthrough state
  const [queryStep, setQueryStep] = useState<number>(99)
  const [queryPlaying, setQueryPlaying] = useState(false)

  // Insertion walkthrough state
  const [insertKeyCount, setInsertKeyCount] = useState<number>(1)
  const [insertPlaying, setInsertPlaying] = useState(false)

  // Selected node for memory inspection
  const [selectedNodeId, setSelectedNodeId] = useState<number>(0)

  // SVG Pan & Zoom
  const svgBoxRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ active: boolean; lx: number; ly: number; moved: boolean }>({ active: false, lx: 0, ly: 0, moved: false })

  // Build the full mini-Trie for query & compare modes
  const fullData = useMemo(() => {
    const t = new PrefixSuffixTrie(512, 2048)
    for (const w of words) t.insert(w)
    return { trie: t, inspected: t.inspect(350), stats: t.stats() }
  }, [words])

  // Build step-by-step insertion sequence & partial Trie for insert mode
  const insertSchedule = useMemo(() => {
    const list: InsertKeyStep[] = []
    words.forEach((w, wi) => {
      for (let start = w.length; start >= 0; start--) {
        list.push({
          wordIndex: wi,
          word: w,
          start,
          key: w.slice(start) + '{' + w,
        })
      }
    })
    return list
  }, [words])

  const clampedInsertCount = Math.max(0, Math.min(insertKeyCount, insertSchedule.length))

  const insertData = useMemo(() => {
    const t = new PrefixSuffixTrie(512, 2048)
    const allocatedIds = new Map<number, number>()
    let lastTrace: InsertEdgeTrace[] = []
    let lastStep: InsertKeyStep | null = null
    for (let i = 0; i < clampedInsertCount; i++) {
      const item = insertSchedule[i]
      let bookId = allocatedIds.get(item.wordIndex)
      if (bookId === undefined) {
        bookId = t.allocBookId()
        allocatedIds.set(item.wordIndex, bookId)
      }
      lastTrace = t.insertSingleWrappedKey(item.word, item.start, bookId)
      lastStep = item
    }
    return {
      trie: t,
      inspected: t.inspect(350),
      stats: t.stats(),
      lastTrace,
      lastStep,
    }
  }, [insertSchedule, clampedInsertCount])

  const activeInspected = tab === 'insert' ? insertData.inspected : fullData.inspected
  const layout = useMemo(() => layoutTrie(activeInspected), [activeInspected])

  // Trace for query mode
  const normP = normalizeClue(prefix).slice(0, 8)
  const normS = normalizeClue(suffix).slice(0, 8)
  const queryTrace = useMemo(() => fullData.trie.trace(normP, normS), [fullData.trie, normP, normS])
  const queryHit = useMemo(() => fullData.trie.search(normP, normS), [fullData.trie, normP, normS])
  const queryMatches = useMemo(() => (queryHit.count > 0 ? fullData.trie.matches(normP, normS, 20) : []), [fullData.trie, normP, normS, queryHit.count])

  const totalQuerySteps = queryTrace.steps.length
  const curQueryStep = Math.max(0, Math.min(queryStep, totalQuerySteps))

  // Reset query step to full walk when query or words change (unless stepping)
  useEffect(() => {
    setQueryStep(queryTrace.steps.length)
    setQueryPlaying(false)
  }, [normP, normS, words, queryTrace.steps.length])

  // Auto-select landed node when query step advances
  useEffect(() => {
    if (tab === 'query') {
      if (curQueryStep === 0) setSelectedNodeId(0)
      else {
        const s = queryTrace.steps[curQueryStep - 1]
        if (s && s.nodeId >= 0) setSelectedNodeId(s.nodeId)
        else if (s && s.fromNodeId >= 0) setSelectedNodeId(s.fromNodeId)
      }
    } else if (tab === 'insert') {
      const last = insertData.lastTrace[insertData.lastTrace.length - 1]
      setSelectedNodeId(last ? last.to : 0)
    }
  }, [tab, curQueryStep, queryTrace.steps, insertData.lastTrace])

  // Playback timers
  useEffect(() => {
    if (!queryPlaying) return
    if (curQueryStep >= totalQuerySteps) {
      setQueryPlaying(false)
      return
    }
    const id = setTimeout(() => setQueryStep((s) => Math.min(totalQuerySteps, s + 1)), 750)
    return () => clearTimeout(id)
  }, [queryPlaying, curQueryStep, totalQuerySteps])

  useEffect(() => {
    if (!insertPlaying) return
    if (clampedInsertCount >= insertSchedule.length) {
      setInsertPlaying(false)
      return
    }
    const id = setTimeout(() => setInsertKeyCount((c) => Math.min(insertSchedule.length, c + 1)), 850)
    return () => clearTimeout(id)
  }, [insertPlaying, clampedInsertCount, insertSchedule.length])

  // Fit SVG tree cleanly inside viewport
  const fitView = () => {
    const el = svgBoxRef.current
    if (!el) return
    const bw = el.clientWidth || 700
    const bh = el.clientHeight || 420
    const sx = (bw - 24) / layout.width
    const sy = (bh - 24) / layout.height
    const nextZoom = Math.max(0.32, Math.min(1.35, Math.min(sx, sy)))
    setZoom(nextZoom)
    setPan({
      x: (bw - layout.width * nextZoom) / 2,
      y: Math.max(8, (bh - layout.height * nextZoom) / 2),
    })
  }

  useEffect(() => {
    fitView()
    const el = svgBoxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fitView())
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height, expanded, tab])

  const loadPreset = (p: Preset) => {
    setPresetId(p.id)
    setWords(p.words)
    setPrefix(p.prefix)
    setSuffix(p.suffix)
    setInsertKeyCount(1)
    setInsertPlaying(false)
  }

  const addCustomWord = () => {
    const clean = normalizeClue(newWord).slice(0, 12)
    if (!clean) return
    if (words.length >= 14) return
    setPresetId('custom')
    setWords((prev) => [...prev, clean])
    setNewWord('')
  }

  const removeWordAt = (idx: number) => {
    if (words.length <= 1) return
    setPresetId('custom')
    setWords((prev) => prev.filter((_, i) => i !== idx))
  }

  // Compute highlighted edges & nodes for the 2D SVG
  const activeEdges = new Set<string>()
  const activeNodes = new Set<number>([0])
  let failedStep: { from: number; char: string } | null = null

  if (tab === 'query' || tab === 'compare') {
    const limit = tab === 'compare' ? queryTrace.steps.length : curQueryStep
    for (let i = 0; i < limit; i++) {
      const st = queryTrace.steps[i]
      if (st.ok) {
        activeEdges.add(`${st.fromNodeId}->${st.nodeId}`)
        activeNodes.add(st.nodeId)
      } else if (st.fromNodeId >= 0) {
        failedStep = { from: st.fromNodeId, char: st.char }
        break
      }
    }
  } else if (tab === 'insert') {
    for (const st of insertData.lastTrace) {
      activeEdges.add(`${st.from}->${st.to}`)
      activeNodes.add(st.to)
    }
  }

  // Lookup selected node object
  const selectedNode = useMemo(() => {
    for (const n of activeInspected.nodes) if (n.id === selectedNodeId) return n
    return activeInspected.nodes[0]
  }, [activeInspected.nodes, selectedNodeId])

  // Narrator text for current query step
  const queryNarrator = useMemo(() => {
    if (curQueryStep === 0) {
      return `Ready at Root (node 0). We combine Suffix "${normS || '∅'}" + "{" + Prefix "${normP || '∅'}" into ONE search key: "${queryTrace.key}". Click Next or Play to walk edge-by-edge.`
    }
    const st = queryTrace.steps[curQueryStep - 1]
    if (!st) return ''
    if (!st.ok) {
      const partLabel = st.isSeparator ? 'separator "{"' : `${st.part} letter "${st.char}"`
      return `Stopped at Step ${curQueryStep}: node #${st.fromNodeId} has no edge for ${partLabel}. Since the path does not exist, we immediately return -1 (0 matches) without scanning any book!`
    }
    if (curQueryStep === totalQuerySteps && queryTrace.complete) {
      return `Finished in ${totalQuerySteps} edge steps! Landed on node #${st.nodeId}. Its list head holds largest ID #${queryHit.id} ("${titleCase(words[queryHit.id])}") out of ${queryHit.count} matching ${queryHit.count === 1 ? 'book' : 'books'} — zero sorting, zero scanning.`
    }
    if (st.isSeparator) {
      return `Step ${curQueryStep}/${totalQuerySteps}: Crossed separator "{" to node #${st.nodeId}. Everything before "{" matched suffix "${normS || '∅'}". From here onward, nodes store exact counts (${st.count}) and max ID (#${st.maxId}).`
    }
    if (st.part === 'suffix') {
      return `Step ${curQueryStep}/${totalQuerySteps}: Walked suffix edge "${st.char}" → node #${st.nodeId}. Still in the suffix zone (before "{"), so no IDs are recorded here yet.`
    }
    return `Step ${curQueryStep}/${totalQuerySteps}: Walked prefix edge "${st.char}" → node #${st.nodeId}. Matching books narrowed to ${st.count} (newest ID so far: #${st.maxId}).`
  }, [curQueryStep, totalQuerySteps, queryTrace, normP, normS, queryHit, words])

  // Naive scan breakdown for Compare tab
  const naiveBreakdown = useMemo(() => {
    let charChecks = 0
    const rows = words.map((w, id) => {
      const pOk = startsWithAt(w, normP, 0)
      const sOk = startsWithAt(w, normS, w.length - normS.length)
      charChecks += Math.min(w.length, normP.length) + (pOk ? Math.min(w.length, normS.length) : 0)
      return { id, title: w, pOk, sOk, match: pOk && sOk }
    })
    const bestId = bruteForceLargestId(words, normP, normS)
    const count = bruteForceCount(words, normP, normS)
    return { rows, charChecks, bestId, count }
  }, [words, normP, normS])

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------- Mini-Catalog Bar */}
      <div className="rounded-2xl border border-[#e3b866]/25 bg-black/25 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#e3b866]">
              <GitBranch size={14} /> Interactive 2D Trie Tree Playground
            </div>
            <p className="mt-0.5 text-xs text-[#f1e4c8]/60">
              Uses the real <code className="text-[#f0cf86]">PrefixSuffixTrie</code> class on a readable mini-catalog ({words.length} books, {activeInspected.nodeTotal} live nodes). Click any node in the tree to inspect its memory!
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPreset(p)}
                title={p.note}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  presetId === p.id
                    ? 'border-[#e3b866] bg-[#e3b866]/20 text-[#f6e7c3]'
                    : 'border-white/10 bg-white/[0.04] text-[#f1e4c8]/70 hover:border-[#e3b866]/40'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                setPresetId('full3000')
                setTab('dual')
                if (!prefix && !suffix) {
                  setPrefix('cat')
                  setSuffix('og')
                }
              }}
              title="Search ALL 3,000 books from catalog.json in the Dual Trie"
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                fullCatalog
                  ? 'border-[#6fd3c4] bg-[#6fd3c4]/20 text-[#8fe3d6]'
                  : 'border-white/10 bg-white/[0.04] text-[#8fe3d6]/80 hover:border-[#6fd3c4]/50'
              }`}
            >
              Full Library (3,000 books)
            </button>
          </div>
        </div>

        {/* Word chips + add custom word */}
        {fullCatalog ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6fd3c4]/25 bg-[#6fd3c4]/[0.07] px-3 py-2 text-xs text-[#8fe3d6]">
            <span>
              Connected to the <b>entire 3,000-book catalog</b> (IDs 0–2999). Any word or suffix in the library (e.g. <code>cat + og</code>, <code>sun + ight</code>, <code>ec + ho</code>, <code>catalog</code>) works in both Prefix Trie (L→R) and Reversed Suffix Trie (R←L)!
            </span>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {words.map((w, i) => {
              const isWinner = tab !== 'insert' && queryHit.id === i
              return (
                <span
                  key={`${w}-${i}`}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono ${
                    isWinner ? 'border-[#e3b866] bg-[#e3b866]/20 text-white' : 'border-white/12 bg-white/[0.05] text-[#f1e4c8]/85'
                  }`}
                >
                  <span className="text-[#e3b866]">#{i}</span>
                  <span>{w}</span>
                  {words.length > 1 && (
                    <button onClick={() => removeWordAt(i)} className="text-[#f1e4c8]/40 hover:text-red-300" title="Remove book">
                      <Trash2 size={11} />
                    </button>
                  )}
                </span>
              )
            })}
            {words.length < 14 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addCustomWord()
                }}
                className="inline-flex items-center gap-1"
              >
                <input
                  value={newWord}
                  onChange={(e) => setNewWord(normalizeClue(e.target.value).slice(0, 12))}
                  placeholder="add title (a-z)"
                  className="w-28 rounded-lg border border-[#e3b866]/25 bg-black/40 px-2.5 py-1 font-mono text-xs text-[#f1e4c8] outline-none focus:border-[#e3b866]"
                  spellCheck={false}
                />
                <button type="submit" disabled={!newWord} className="inline-flex items-center gap-1 rounded-lg border border-[#e3b866]/35 bg-[#e3b866]/15 px-2.5 py-1 text-xs font-medium text-[#f0cf86] hover:bg-[#e3b866]/25 disabled:opacity-40">
                  <Plus size={12} /> Add
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* --------------------------------------------------- Walkthrough Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'dual', label: '1. Dual Trie (L→R & R←L + 2-Pointer)', icon: ArrowLeftRight },
            { id: 'query', label: '2. Suffix-Wrapped Walk (O(|P|+|S|))', icon: Search },
            { id: 'insert', label: '3. Watch Tree Build (L+1 Keys)', icon: Sparkles },
            { id: 'compare', label: '4. Trie vs. Naive + Typed Arrays', icon: Zap },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              if (t.id !== 'dual' && fullCatalog) setPresetId('flagship')
              setTab(t.id)
              setQueryPlaying(false)
              setInsertPlaying(false)
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              tab === t.id
                ? 'border-[#e3b866] bg-[#e3b866] text-[#2a1a0c] shadow-[0_4px_16px_rgba(227,184,102,0.3)]'
                : 'border-white/12 bg-white/[0.04] text-[#f1e4c8]/80 hover:border-[#e3b866]/45'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'dual' && (
        <DualTrieVisualizer2D
          words={words}
          prefix={prefix}
          suffix={suffix}
          onPrefixChange={setPrefix}
          onSuffixChange={setSuffix}
          fullCatalog={fullCatalog}
          expanded={expanded}
        />
      )}

      {/* -------------------------------------------- Controls for Query Mode */}
      {tab === 'query' && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#f0cf86]">Prefix (Starts with)</span>
              <input
                value={prefix}
                onChange={(e) => setPrefix(normalizeClue(e.target.value).slice(0, 8))}
                placeholder="e.g. cat (or empty)"
                className={inputCls + ' !py-2 font-mono text-sm tracking-widest'}
                spellCheck={false}
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8fe3d6]">Suffix (Ends with)</span>
              <input
                value={suffix}
                onChange={(e) => setSuffix(normalizeClue(e.target.value).slice(0, 8))}
                placeholder="e.g. og (or empty)"
                className={inputCls + ' !py-2 font-mono text-sm tracking-widest'}
                spellCheck={false}
              />
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setQueryPlaying(false)
                  setQueryStep(0)
                }}
                className={btnGhost + ' !px-2.5 !py-2 text-xs'}
                title="Reset to Root"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => {
                  setQueryPlaying(false)
                  setQueryStep((s) => Math.max(0, s - 1))
                }}
                disabled={curQueryStep <= 0}
                className={btnGhost + ' !px-2.5 !py-2 text-xs'}
                title="Previous edge"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => {
                  if (curQueryStep >= totalQuerySteps) setQueryStep(0)
                  setQueryPlaying((p) => !p)
                }}
                className={btnGold + ' !px-3.5 !py-2 text-xs'}
              >
                {queryPlaying ? <Pause size={13} /> : <Play size={13} />} {queryPlaying ? 'Pause' : 'Play Walk'}
              </button>
              <button
                onClick={() => {
                  setQueryPlaying(false)
                  setQueryStep((s) => Math.min(totalQuerySteps, s + 1))
                }}
                disabled={curQueryStep >= totalQuerySteps}
                className={btnGhost + ' !px-2.5 !py-2 text-xs'}
                title="Next edge"
              >
                Next <ChevronRight size={14} />
              </button>
              <button
                onClick={() => {
                  setQueryPlaying(false)
                  setQueryStep(totalQuerySteps)
                }}
                disabled={curQueryStep >= totalQuerySteps}
                className={btnGhost + ' !px-2.5 !py-2 text-xs'}
                title="Jump to end"
              >
                <SkipForward size={13} />
              </button>
            </div>
          </div>

          {/* Transformed single-key ribbon */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#f1e4c8]/60">Transformed into 1 key:</span>
            <div className="flex flex-wrap items-center gap-1">
              {queryTrace.steps.map((st, idx) => {
                const done = idx < curQueryStep
                const current = idx === curQueryStep - 1
                const tone =
                  done && !st.ok
                    ? 'border-red-400 bg-red-500/20 text-red-200'
                    : done
                      ? st.isSeparator
                        ? 'border-white bg-white/20 text-white'
                        : st.part === 'suffix'
                          ? 'border-[#6fd3c4] bg-[#6fd3c4]/20 text-[#8fe3d6]'
                          : 'border-[#e3b866] bg-[#e3b866]/25 text-[#f6e7c3]'
                      : 'border-white/10 bg-white/[0.03] text-[#f1e4c8]/40'
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setQueryPlaying(false)
                      setQueryStep(idx + 1)
                    }}
                    className={`grid h-7 w-7 place-items-center rounded-md border font-mono text-sm font-bold transition ${tone} ${
                      current ? 'ring-2 ring-[#e3b866]/70 scale-105' : ''
                    }`}
                  >
                    {st.char}
                  </button>
                )
              })}
            </div>
            <span className="ml-auto font-mono text-[11px] text-[#f1e4c8]/60">
              Step {curQueryStep}/{totalQuerySteps}
            </span>
          </div>

          {/* Live narrator */}
          <div className={`rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${failedStep ? 'border-red-400/35 bg-red-500/10 text-red-200' : 'border-[#e3b866]/30 bg-[#e3b866]/[0.08] text-[#f6ead0]'}`}>
            {queryNarrator}
          </div>
        </div>
      )}

      {/* ------------------------------------------- Controls for Insert Mode */}
      {tab === 'insert' && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-[#f1e4c8]/75">
              Watch how <b className="text-[#f0cf86]">{words.length} books</b> expand into <b className="text-[#f0cf86]">{insertSchedule.length} wrapped keys</b> (each word of length L inserts L+1 keys).
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setInsertPlaying(false)
                  setInsertKeyCount(0)
                }}
                className={btnGhost + ' !px-2.5 !py-1.5 text-xs'}
                title="Empty tree (root only)"
              >
                <RotateCcw size={13} /> Empty
              </button>
              <button
                onClick={() => {
                  setInsertPlaying(false)
                  setInsertKeyCount((c) => Math.max(0, c - 1))
                }}
                disabled={clampedInsertCount <= 0}
                className={btnGhost + ' !px-2.5 !py-1.5 text-xs'}
              >
                <ChevronLeft size={14} /> Prev Key
              </button>
              <button
                onClick={() => {
                  if (clampedInsertCount >= insertSchedule.length) setInsertKeyCount(0)
                  setInsertPlaying((p) => !p)
                }}
                className={btnGold + ' !px-3.5 !py-1.5 text-xs'}
              >
                {insertPlaying ? <Pause size={13} /> : <Play size={13} />} {insertPlaying ? 'Pause' : 'Play Build'}
              </button>
              <button
                onClick={() => {
                  setInsertPlaying(false)
                  setInsertKeyCount((c) => Math.min(insertSchedule.length, c + 1))
                }}
                disabled={clampedInsertCount >= insertSchedule.length}
                className={btnGhost + ' !px-2.5 !py-1.5 text-xs'}
              >
                Next Key <ChevronRight size={14} />
              </button>
              <button
                onClick={() => {
                  setInsertPlaying(false)
                  setInsertKeyCount(insertSchedule.length)
                }}
                disabled={clampedInsertCount >= insertSchedule.length}
                className={btnGhost + ' !px-2.5 !py-1.5 text-xs'}
              >
                All ({insertSchedule.length})
              </button>
            </div>
          </div>

          {insertData.lastStep ? (
            <div className="rounded-xl border border-[#e3b866]/30 bg-[#e3b866]/[0.08] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#f6ead0]">
              Inserted key <b>{clampedInsertCount}/{insertSchedule.length}</b> for book{' '}
              <span className="font-mono text-[#f0cf86]">
                #{insertData.lastStep.wordIndex} ({insertData.lastStep.word})
              </span>
              :{' '}
              <span className="rounded bg-black/40 px-2 py-0.5 font-mono">
                <span className="text-[#8fe3d6]">{insertData.lastStep.key.split('{')[0]}</span>
                <span className="text-white">{'{'}</span>
                <span className="text-[#f0cf86]">{insertData.lastStep.key.split('{')[1]}</span>
              </span>
              . Edges before <code className="text-white">{'{'}</code> do <b>not</b> store IDs (<code className="text-[#8fe3d6]">record=false</code>); every node at &amp; after <code className="text-white">{'{'}</code> pushes{' '}
              <code className="text-[#f0cf86]">#{insertData.lastStep.wordIndex}</code> to the <b>head</b> of its list so the largest ID is always first!
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-[#f1e4c8]/70">
              Tree is empty (only Root node #0). Click <b>Next Key</b> or <b>Play Build</b> to watch wrapped keys grow the tree!
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------ 2D Interactive SVG */}
      {(tab === 'query' || tab === 'insert') && (
        <div className="rounded-2xl border border-[#e3b866]/25 bg-[#0e0804] overflow-hidden">
          {/* Legend + zoom bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3.5 py-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-3 text-[#f1e4c8]/75">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[#6fd3c4] bg-[#6fd3c4]/25" /> Suffix zone (before {'{'})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-white bg-white/30" /> Separator {'{'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-[#e3b866] bg-[#e3b866]/25" /> Post-{'{'} (stores ×count &amp; max #id)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.15))} className="rounded-md border border-white/10 p-1 text-[#f1e4c8]/75 hover:bg-white/10" title="Zoom out">
                <ZoomOut size={13} />
              </button>
              <span className="w-11 text-center font-mono text-[11px] text-[#f1e4c8]/70">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="rounded-md border border-white/10 p-1 text-[#f1e4c8]/75 hover:bg-white/10" title="Zoom in">
                <ZoomIn size={13} />
              </button>
              <button onClick={fitView} className="ml-1 inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-[#f1e4c8]/75 hover:bg-white/10" title="Fit tree to view">
                <Maximize2 size={11} /> Fit
              </button>
            </div>
          </div>

          <div
            ref={svgBoxRef}
            className={`relative w-full select-none overflow-hidden cursor-grab active:cursor-grabbing ${expanded ? 'h-[500px]' : 'h-[400px]'}`}
            onPointerDown={(e) => {
              dragRef.current = { active: true, lx: e.clientX, ly: e.clientY, moved: false }
            }}
            onPointerMove={(e) => {
              if (!dragRef.current.active) return
              const dx = e.clientX - dragRef.current.lx
              const dy = e.clientY - dragRef.current.ly
              if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true
              dragRef.current.lx = e.clientX
              dragRef.current.ly = e.clientY
              setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
            }}
            onPointerUp={() => {
              dragRef.current.active = false
            }}
            onPointerCancel={() => {
              dragRef.current.active = false
            }}
          >
            <svg width="100%" height="100%" className="block">
              <defs>
                <pattern id="trie-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(227,184,102,0.06)" strokeWidth="1" />
                </pattern>
                <filter id="trie-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width="100%" height="100%" fill="url(#trie-grid)" />

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {activeInspected.nodes.map((n) => {
                  const p0 = layout.positions.get(n.id)
                  if (!p0) return null
                  return n.edges.map((e) => {
                    const p1 = layout.positions.get(e.to)
                    if (!p1) return null
                    const isActive = activeEdges.has(`${n.id}->${e.to}`)
                    const childZone = p1.node.zone
                    const stroke = isActive
                      ? e.isSeparator
                        ? '#ffffff'
                        : childZone === 'suffix'
                          ? '#6fd3c4'
                          : '#f0cf86'
                      : 'rgba(241, 228, 200, 0.16)'
                    const mx = (p0.x + p1.x) / 2
                    const my = (p0.y + p1.y) / 2
                    return (
                      <g key={`${n.id}-${e.to}`}>
                        <path
                          d={`M ${p0.x} ${p0.y} C ${p0.x} ${my}, ${p1.x} ${my}, ${p1.x} ${p1.y}`}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={isActive ? 3 : 1.4}
                          filter={isActive ? 'url(#trie-glow)' : undefined}
                        />
                        <circle cx={mx} cy={my} r={10} fill="#140c06" stroke={stroke} strokeWidth={isActive ? 1.8 : 1} />
                        <text
                          x={mx}
                          y={my + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fontFamily="ui-monospace, monospace"
                          fill={isActive ? '#fff' : 'rgba(241,228,200,0.7)'}
                        >
                          {e.char}
                        </text>
                      </g>
                    )
                  })
                })}

                {/* Failed edge marker if query stopped early */}
                {failedStep && layout.positions.has(failedStep.from) && (
                  <g>
                    {(() => {
                      const p0 = layout.positions.get(failedStep.from)!
                      return (
                        <>
                          <line x1={p0.x} y1={p0.y + 18} x2={p0.x + 28} y2={p0.y + 52} stroke="#f87171" strokeWidth="2.4" strokeDasharray="4 3" />
                          <circle cx={p0.x + 32} cy={p0.y + 58} r="12" fill="#450a0a" stroke="#f87171" strokeWidth="2" />
                          <text x={p0.x + 32} y={p0.y + 62} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fecaca">
                            ✕{failedStep.char}
                          </text>
                        </>
                      )
                    })()}
                  </g>
                )}

                {/* Nodes */}
                {activeInspected.nodes.map((n) => {
                  const pos = layout.positions.get(n.id)
                  if (!pos) return null
                  const isActive = activeNodes.has(n.id)
                  const isSelected = n.id === selectedNodeId
                  const r = n.id === 0 ? 18 : n.zone === 'separator' ? 16 : 14
                  const fill =
                    n.id === 0
                      ? '#2d1c10'
                      : n.zone === 'separator'
                        ? isActive
                          ? '#4c3b1e'
                          : '#261e14'
                        : n.zone === 'suffix'
                          ? isActive
                            ? '#134e4a'
                            : '#142625'
                          : isActive
                            ? '#5c4114'
                            : '#24180d'
                  const stroke = isSelected
                    ? '#ffffff'
                    : isActive
                      ? n.zone === 'separator'
                        ? '#ffffff'
                        : n.zone === 'suffix'
                          ? '#6fd3c4'
                          : '#f0cf86'
                      : n.zone === 'suffix'
                        ? 'rgba(111,211,196,0.35)'
                        : n.zone === 'separator'
                          ? 'rgba(255,255,255,0.4)'
                          : 'rgba(227,184,102,0.35)'
                  return (
                    <g
                      key={n.id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!dragRef.current.moved) setSelectedNodeId(n.id)
                      }}
                    >
                      {isSelected && <circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" />}
                      <circle cx={pos.x} cy={pos.y} r={r} fill={fill} stroke={stroke} strokeWidth={isActive || isSelected ? 2.4 : 1.3} filter={isActive ? 'url(#trie-glow)' : undefined} />
                      <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace" fill="#f6e7c3">
                        {n.id === 0 ? 'ROOT' : n.zone === 'separator' ? '{' : n.viaChar}
                      </text>
                      {/* Post-separator metadata badge (count & head maxId) */}
                      {(n.zone === 'separator' || n.zone === 'prefix') && n.count > 0 && (
                        <g transform={`translate(${pos.x}, ${pos.y + r + 13})`}>
                          <rect x="-22" y="-9" width="44" height="15" rx="4" fill="rgba(16,10,6,0.9)" stroke={isActive ? '#e3b866' : 'rgba(227,184,102,0.3)'} strokeWidth="0.9" />
                          <text x="0" y="2" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#f0cf86">
                            ×{n.count} #{n.ids[0]}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute bottom-2 left-3 rounded-lg bg-black/65 px-2.5 py-1 text-[10.5px] text-[#f1e4c8]/60">
              Drag background to pan · Click any node to inspect its array slots &amp; ID list
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------- Tab 3: Side-by-Side + Memory Table */}
      {tab === 'compare' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e3b866]/35 bg-[#e3b866]/[0.06] p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-lg font-semibold text-[#f0cf86]">Trie Walk: O(|P| + |S|)</h4>
              <span className="rounded-full bg-[#e3b866]/20 px-2.5 py-0.5 font-mono text-xs text-[#f0cf86]">{queryTrace.edgesWalked} edges</span>
            </div>
            <p className="mt-1 text-xs text-[#f1e4c8]/65">
              Walks key <code className="text-white">{queryTrace.key}</code> once. Never looks at the other books!
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-[#f1e4c8]/80">ROOT</span>
              {queryTrace.steps.map((st, idx) => (
                <span key={idx} className="inline-flex items-center gap-1">
                  <ArrowRight size={12} className="text-[#f1e4c8]/40" />
                  <span
                    className={`rounded-lg border px-2 py-1 font-mono text-xs font-semibold ${
                      !st.ok
                        ? 'border-red-400/60 bg-red-500/20 text-red-200'
                        : st.isSeparator
                          ? 'border-white/50 bg-white/15 text-white'
                          : st.part === 'suffix'
                            ? 'border-[#6fd3c4]/50 bg-[#6fd3c4]/15 text-[#8fe3d6]'
                            : 'border-[#e3b866]/50 bg-[#e3b866]/20 text-[#f0cf86]'
                    }`}
                  >
                    {st.char} {st.ok ? `(#${st.nodeId})` : '✕'}
                  </span>
                </span>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-[#f1e4c8]/80">
              {queryHit.id >= 0 ? (
                <>
                  Answer: <b className="text-[#f0cf86]">#{queryHit.id} ({words[queryHit.id]})</b> · {queryHit.count} matches · IDs descending:{' '}
                  <span className="font-mono text-[#8fe3d6]">[{queryMatches.join(' → ')}]</span>
                </>
              ) : (
                <>Answer: <b>-1</b> (0 matches — stopped immediately at missing edge).</>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/25 p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-lg font-semibold text-[#f1e4c8]/90">Naive Scan: O(N · L)</h4>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-xs text-[#f1e4c8]/75">{naiveBreakdown.charChecks} char checks</span>
            </div>
            <p className="mt-1 text-xs text-[#f1e4c8]/60">
              Checks every book in the catalog one by one. On 3,000 books, that is up to <b>3,000 × 8 = 24,000</b> checks vs. <b>{queryTrace.steps.length}</b> Trie edges!
            </p>
            <div className="mt-3 space-y-1.5">
              {naiveBreakdown.rows.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 font-mono text-xs ${
                    r.id === naiveBreakdown.bestId
                      ? 'border-[#e3b866]/50 bg-[#e3b866]/15 text-white'
                      : r.match
                        ? 'border-[#6fd3c4]/30 bg-[#6fd3c4]/10 text-[#8fe3d6]'
                        : 'border-white/5 bg-white/[0.02] text-[#f1e4c8]/50'
                  }`}
                >
                  <span>
                    #{r.id} {r.title}
                  </span>
                  <span>
                    P:{r.pOk ? '✓' : '✕'} · S:{r.sOk ? '✓' : '✕'} {r.id === naiveBreakdown.bestId ? ' ← max ID' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------- Real Int32Array Inspector */}
      {tab !== 'dual' && selectedNode && (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#e3b866]">
              <Cpu size={14} /> Real Typed-Array Node Inspector · Node #{selectedNode.id}
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px] text-[#f1e4c8]/70">
              <span>zone: {selectedNode.zone}</span>
              <span>· depth: {selectedNode.depth}</span>
              <span>· counts[{selectedNode.id}] = {selectedNode.count}</span>
              <span>· heads[{selectedNode.id}] = {selectedNode.headEntry}</span>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-black/30 p-2.5 text-xs">
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#f1e4c8]/55">
                Outgoing Edges in <code className="text-[#f0cf86]">children[node * 27 + c]</code>
              </div>
              {selectedNode.edges.length === 0 ? (
                <div className="text-[#f1e4c8]/45">Leaf node (all 27 slots are 0).</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.edges.map((e) => (
                    <button
                      key={e.to}
                      onClick={() => setSelectedNodeId(e.to)}
                      className="rounded-md border border-white/12 bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] text-[#f1e4c8]/85 hover:border-[#e3b866]"
                    >
                      '{e.char}' (slot {selectedNode.id * 27 + e.code}) → #{e.to}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/8 bg-black/30 p-2.5 text-xs">
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#f1e4c8]/55">
                Head-Inserted Linked List (<code className="text-[#8fe3d6]">entryId / entryNext</code>)
              </div>
              {selectedNode.ids.length === 0 ? (
                <div className="text-[#f1e4c8]/45">
                  {selectedNode.zone === 'root' || selectedNode.zone === 'suffix'
                    ? 'Empty (before "{" separator, record = false).'
                    : 'No entries yet.'}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1 font-mono text-[11px]">
                  <span className="text-[#f1e4c8]/50">head →</span>
                  {selectedNode.ids.map((id, idx) => (
                    <span key={`${id}-${idx}`} className="inline-flex items-center gap-1">
                      <span className={`rounded border px-1.5 py-0.5 ${idx === 0 ? 'border-[#e3b866] bg-[#e3b866]/20 text-[#f6e7c3]' : 'border-white/12 bg-white/5 text-[#f1e4c8]/80'}`}>
                        #{id} ({words[id]})
                      </span>
                      {idx < selectedNode.ids.length - 1 && <span className="text-[#f1e4c8]/40">→</span>}
                    </span>
                  ))}
                  <span className="text-[#f1e4c8]/40">→ -1</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
