import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { DualTrie, TrieNode, buildDisplaySubtree, sortedChildren, type WalkStep } from '../lib/dualTrie'
import { TITLES, normalizeClue, titleCase } from '../lib/catalog'
import { btnGhost, btnGold } from './common'

let cachedFullDual: DualTrie | null = null
function getFullDualTrie(): DualTrie {
  if (!cachedFullDual) {
    const d = new DualTrie()
    for (let i = 0; i < TITLES.length; i++) d.insert(TITLES[i])
    cachedFullDual = d
  }
  return cachedFullDual
}

/* ============================================================================
 *  Side-by-Side Live SVG Prefix Trie (L -> R) & Reversed Suffix Trie (R -> L)
 *  Connected directly to TrieNode objects, with Zoom, Clickable recordIds,
 *  Step Playback, and Live Two-Pointer Step Table.
 * ========================================================================== */

interface PositionedNode {
  node: TrieNode
  x: number
  y: number
}

interface HorizontalLayout {
  nodes: PositionedNode[]
  edges: { from: PositionedNode; to: PositionedNode; char: string }[]
  width: number
  height: number
}

function layoutHorizontalTrie(root: TrieNode, direction: 'ltr' | 'rtl'): HorizontalLayout {
  const leafSpan = new Map<number, number>()
  const measure = (n: TrieNode): number => {
    const ch = sortedChildren(n)
    if (ch.length === 0) {
      leafSpan.set(n.id, 1)
      return 1
    }
    let sum = 0
    for (const c of ch) sum += measure(c)
    const span = Math.max(1, sum)
    leafSpan.set(n.id, span)
    return span
  }
  const totalRows = measure(root)

  const COL_X = 86
  const ROW_Y = 56
  const PAD_X = 52
  const PAD_Y = 36

  let maxDepth = 0
  const findMaxDepth = (n: TrieNode) => {
    if (n.depth > maxDepth) maxDepth = n.depth
    for (const c of sortedChildren(n)) findMaxDepth(c)
  }
  findMaxDepth(root)

  const width = Math.max(460, (maxDepth + 1) * COL_X + PAD_X * 2)
  const height = Math.max(260, totalRows * ROW_Y + PAD_Y * 2)

  const nodes: PositionedNode[] = []
  const byId = new Map<number, PositionedNode>()
  const edges: { from: PositionedNode; to: PositionedNode; char: string }[] = []

  const place = (n: TrieNode, yStart: number, span: number) => {
    const x =
      direction === 'ltr'
        ? PAD_X + n.depth * COL_X
        : width - PAD_X - n.depth * COL_X
    const y = PAD_Y + (yStart + span / 2) * ROW_Y
    const pn: PositionedNode = { node: n, x, y }
    nodes.push(pn)
    byId.set(n.id, pn)

    let cursor = yStart
    for (const c of sortedChildren(n)) {
      const cs = leafSpan.get(c.id) ?? 1
      place(c, cursor, cs)
      const cp = byId.get(c.id)!
      edges.push({ from: pn, to: cp, char: c.char })
      cursor += cs
    }
  }
  place(root, 0, totalRows)

  return { nodes, edges, width, height }
}

function TrieSvgPane({
  title,
  subtitle,
  direction,
  root,
  walkSteps,
  activeWalkCount,
  accent,
  selectedNode,
  onSelectNode,
  words,
  expanded,
}: {
  title: string
  subtitle: string
  direction: 'ltr' | 'rtl'
  root: TrieNode
  walkSteps: WalkStep[]
  activeWalkCount: number
  accent: 'gold' | 'teal'
  selectedNode: { tree: 'prefix' | 'suffix'; node: TrieNode } | null
  onSelectNode: (node: TrieNode) => void
  words: string[]
  expanded: boolean
}) {
  const layout = useMemo(() => layoutHorizontalTrie(root, direction), [root, direction])
  const boxRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef({ active: false, lx: 0, ly: 0, moved: false })

  const fit = () => {
    const el = boxRef.current
    if (!el) return
    const bw = el.clientWidth || 460
    const bh = el.clientHeight || 280
    const z = Math.max(0.35, Math.min(1.25, Math.min((bw - 20) / layout.width, (bh - 20) / layout.height)))
    setZoom(z)
    setPan({ x: (bw - layout.width * z) / 2, y: (bh - layout.height * z) / 2 })
  }

  useEffect(() => {
    fit()
    const el = boxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fit())
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, layout.width, layout.height, expanded])

  const activeNodeIds = new Set<number>([root.id])
  const activeEdgeKeys = new Set<string>()
  let failAt: { fromId: number; char: string } | null = null

  const limit = Math.min(activeWalkCount, walkSteps.length)
  for (let i = 0; i < limit; i++) {
    const s = walkSteps[i]
    if (s.ok && s.fromNode && s.toNode) {
      activeEdgeKeys.add(`${s.fromNode.id}->${s.toNode.id}`)
      activeNodeIds.add(s.toNode.id)
    } else if (!s.ok && s.fromNode) {
      failAt = { fromId: s.fromNode.id, char: s.char }
      break
    }
  }

  const accentHex = accent === 'gold' ? '#f0cf86' : '#6fd3c4'
  const accentFill = accent === 'gold' ? '#4a3312' : '#134843'
  const treeKind = direction === 'ltr' ? 'prefix' : 'suffix'

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0e0804]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/45 px-3 py-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: accentHex }}>
            <span>{title}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#f1e4c8]/75">
              {direction === 'ltr' ? 'L → R' : 'R ← L'}
            </span>
          </div>
          <div className="text-[11px] text-[#f1e4c8]/55">{subtitle}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            className="rounded border border-white/10 p-1 text-[#f1e4c8]/75 hover:bg-white/10"
            title="Zoom out"
          >
            <ZoomOut size={12} />
          </button>
          <span className="w-10 text-center font-mono text-[10.5px] text-[#f1e4c8]/70">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="rounded border border-white/10 p-1 text-[#f1e4c8]/75 hover:bg-white/10"
            title="Zoom in"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={fit}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[10.5px] text-[#f1e4c8]/75 hover:bg-white/10"
            title="Fit tree"
          >
            <Maximize2 size={10} /> Fit
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className={`relative w-full select-none overflow-hidden cursor-grab active:cursor-grabbing ${expanded ? 'h-[360px]' : 'h-[290px]'}`}
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
            <pattern id={`grid-${treeKind}`} width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(227,184,102,0.05)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${treeKind})`} />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {layout.edges.map((e) => {
              const active = activeEdgeKeys.has(`${e.from.node.id}->${e.to.node.id}`)
              const mx = (e.from.x + e.to.x) / 2
              const my = (e.from.y + e.to.y) / 2
              return (
                <g key={`${e.from.node.id}-${e.to.node.id}`}>
                  <path
                    d={`M ${e.from.x} ${e.from.y} C ${mx} ${e.from.y}, ${mx} ${e.to.y}, ${e.to.x} ${e.to.y}`}
                    fill="none"
                    stroke={active ? accentHex : 'rgba(241,228,200,0.16)'}
                    strokeWidth={active ? 2.8 : 1.3}
                  />
                  <circle
                    cx={mx}
                    cy={my}
                    r={9}
                    fill="#140c06"
                    stroke={active ? accentHex : 'rgba(241,228,200,0.22)'}
                    strokeWidth={active ? 1.6 : 1}
                  />
                  <text
                    x={mx}
                    y={my + 3.5}
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="700"
                    fontFamily="ui-monospace, monospace"
                    fill={active ? '#fff' : 'rgba(241,228,200,0.68)'}
                  >
                    {e.char}
                  </text>
                </g>
              )
            })}

            {failAt &&
              (() => {
                const fn = layout.nodes.find((n) => n.node.id === failAt!.fromId)
                if (!fn) return null
                const dx = direction === 'ltr' ? 42 : -42
                return (
                  <g>
                    <line x1={fn.x} y1={fn.y} x2={fn.x + dx} y2={fn.y + 18} stroke="#f87171" strokeWidth="2.2" strokeDasharray="4 3" />
                    <circle cx={fn.x + dx} cy={fn.y + 18} r="11" fill="#450a0a" stroke="#f87171" strokeWidth="1.8" />
                    <text x={fn.x + dx} y={fn.y + 22} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fecaca">
                      ✕{failAt.char}
                    </text>
                  </g>
                )
              })()}

            {layout.nodes.map((pn) => {
              const n = pn.node
              const isRoot = n.depth === 0
              const active = activeNodeIds.has(n.id)
              const isSelected = selectedNode?.tree === treeKind && selectedNode.node.id === n.id
              const r = isRoot ? 17 : 13
              return (
                <g
                  key={n.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!dragRef.current.moved) onSelectNode(n)
                  }}
                >
                  {isSelected && <circle cx={pn.x} cy={pn.y} r={r + 5} fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2" />}
                  <circle
                    cx={pn.x}
                    cy={pn.y}
                    r={r}
                    fill={active ? accentFill : '#22160d'}
                    stroke={isSelected ? '#ffffff' : active ? accentHex : 'rgba(241,228,200,0.28)'}
                    strokeWidth={active || isSelected ? 2.2 : 1.2}
                  />
                  <text
                    x={pn.x}
                    y={pn.y + 3.5}
                    textAnchor="middle"
                    fontSize={isRoot ? '9' : '10.5'}
                    fontWeight="700"
                    fontFamily="ui-monospace, monospace"
                    fill="#f6e7c3"
                  >
                    {isRoot ? 'ROOT' : n.char}
                  </text>
                  {/* Sorted recordIds preview pill */}
                  <g transform={`translate(${pn.x}, ${pn.y + r + 11})`}>
                    <rect
                      x="-22"
                      y="-7"
                      width="44"
                      height="13"
                      rx="3.5"
                      fill="rgba(16,10,6,0.92)"
                      stroke={active ? accentHex : 'rgba(255,255,255,0.14)'}
                      strokeWidth="0.8"
                    />
                    <text x="0" y="2.5" textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fill={active ? accentHex : 'rgba(241,228,200,0.72)'}>
                      [{n.recordIds.length <= 3 ? n.recordIds.join(',') : `${n.recordIds.length} ids`}]
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute bottom-1.5 left-2.5 rounded bg-black/65 px-2 py-0.5 text-[10px] text-[#f1e4c8]/55">
          Click any TrieNode to view its full sorted recordIds ({words.length} books)
        </div>
      </div>
    </div>
  )
}

export function DualTrieVisualizer2D({
  words,
  prefix,
  suffix,
  onPrefixChange,
  onSuffixChange,
  fullCatalog = false,
  expanded = false,
}: {
  words: string[]
  prefix: string
  suffix: string
  onPrefixChange: (v: string) => void
  onSuffixChange: (v: string) => void
  fullCatalog?: boolean
  expanded?: boolean
}) {
  const miniDual = useMemo(() => {
    if (fullCatalog) return null
    const d = new DualTrie()
    for (const w of words) d.insert(w)
    return d
  }, [words, fullCatalog])

  const dual = fullCatalog ? getFullDualTrie() : miniDual!
  const activeWords = fullCatalog ? TITLES : words

  const normP = normalizeClue(prefix).slice(0, 12)
  const normS = normalizeClue(suffix).slice(0, 12)
  const trace = useMemo(() => dual.traceQuery(normP, normS), [dual, normP, normS])

  const prefixDisplay = useMemo(
    () => (fullCatalog ? buildDisplaySubtree(dual.prefixRoot, trace.prefixSteps) : { root: dual.prefixRoot, realById: null }),
    [fullCatalog, dual.prefixRoot, trace.prefixSteps],
  )
  const suffixDisplay = useMemo(
    () => (fullCatalog ? buildDisplaySubtree(dual.suffixRoot, trace.suffixSteps) : { root: dual.suffixRoot, realById: null }),
    [fullCatalog, dual.suffixRoot, trace.suffixSteps],
  )

  // Unified timeline:
  // 0 = Ready at roots
  // 1..pLen = Prefix Trie steps (L -> R)
  // pLen+1 .. pLen+sLen = Reversed Suffix Trie steps (R -> L)
  // pLen+sLen+1 .. total = Two-pointer steps
  const pLen = trace.prefixSteps.length
  const sLen = trace.suffixSteps.length
  const tpLen = trace.pointerSteps.length
  const totalSteps = pLen + sLen + tpLen

  const [step, setStep] = useState<number>(totalSteps)
  const [playing, setPlaying] = useState(false)
  const [focusTree, setFocusTree] = useState<'prefix' | 'suffix'>('prefix')
  const [showAllIds, setShowAllIds] = useState(false)
  const [selectedNode, setSelectedNode] = useState<{ tree: 'prefix' | 'suffix'; node: TrieNode } | null>(null)

  useEffect(() => {
    setStep(totalSteps)
    setPlaying(false)
    setShowAllIds(false)
    if ((focusTree === 'suffix' || !normP) && normS) {
      setSelectedNode({ tree: 'suffix', node: trace.suffixNode ?? dual.suffixRoot })
    } else if (trace.prefixNode) {
      setSelectedNode({ tree: 'prefix', node: trace.prefixNode })
    } else {
      setSelectedNode({ tree: 'prefix', node: dual.prefixRoot })
    }
  }, [trace, totalSteps, dual, focusTree, normP, normS])

  useEffect(() => {
    if (!playing) return
    if (step >= totalSteps) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setStep((s) => Math.min(totalSteps, s + 1)), 750)
    return () => clearTimeout(timer)
  }, [playing, step, totalSteps])

  const curStep = Math.max(0, Math.min(step, totalSteps))
  const activePrefixWalk = Math.min(curStep, pLen)
  const activeSuffixWalk = Math.max(0, Math.min(curStep - pLen, sLen))
  const activePointerSteps = Math.max(0, curStep - pLen - sLen)
  const currentTp = activePointerSteps > 0 ? trace.pointerSteps[activePointerSteps - 1] : null

  const phaseText =
    curStep === 0
      ? 'Step 0: At both ROOT nodes. Click Play or Step Forward to walk Prefix Trie (L→R), Reversed Suffix Trie (R←L), and Two-Pointer merge.'
      : curStep <= pLen
        ? `Phase 1 (Prefix Trie L→R): walking "${normP[curStep - 1]}" (${curStep}/${pLen}).`
        : curStep <= pLen + sLen
          ? `Phase 2 (Reversed Suffix Trie R←L): walking "${trace.reversedSuffix[curStep - pLen - 1]}" (${curStep - pLen}/${sLen}) for suffix "${normS}".`
          : `Phase 3 (Two-Pointer Intersection): step ${activePointerSteps}/${tpLen} — ${currentTp?.action ?? ''}`

  return (
    <div className="space-y-3.5">
      {/* Query inputs + Playback Bar */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#f0cf86]">Prefix (walked L → R)</span>
            <input
              value={prefix}
              onChange={(e) => {
                setFocusTree('prefix')
                onPrefixChange(normalizeClue(e.target.value).slice(0, 12))
              }}
              placeholder="e.g. cat (or empty)"
              className="w-full rounded-xl border border-[#e3b866]/25 bg-black/40 px-3 py-2 font-mono text-sm tracking-widest text-[#f1e4c8] outline-none focus:border-[#e3b866]"
              spellCheck={false}
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8fe3d6]">
              Suffix (walked R ← L as “{trace.reversedSuffix || '∅'}”)
            </span>
            <input
              value={suffix}
              onChange={(e) => {
                setFocusTree('suffix')
                onSuffixChange(normalizeClue(e.target.value).slice(0, 12))
              }}
              placeholder="e.g. og (or full word)"
              className="w-full rounded-xl border border-[#e3b866]/25 bg-black/40 px-3 py-2 font-mono text-sm tracking-widest text-[#f1e4c8] outline-none focus:border-[#6fd3c4]"
              spellCheck={false}
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setPlaying(false)
                setStep(0)
              }}
              className={btnGhost + ' !px-2.5 !py-2 text-xs'}
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button
              onClick={() => {
                setPlaying(false)
                setStep((s) => Math.max(0, s - 1))
              }}
              disabled={curStep <= 0}
              className={btnGhost + ' !px-2.5 !py-2 text-xs'}
            >
              <ChevronLeft size={14} /> Step Backward
            </button>
            <button
              onClick={() => {
                if (curStep >= totalSteps) setStep(0)
                setPlaying((p) => !p)
              }}
              className={btnGold + ' !px-3.5 !py-2 text-xs'}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setPlaying(false)
                setStep((s) => Math.min(totalSteps, s + 1))
              }}
              disabled={curStep >= totalSteps}
              className={btnGhost + ' !px-2.5 !py-2 text-xs'}
            >
              Step Forward <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e3b866]/25 bg-[#e3b866]/[0.08] px-3 py-2 text-xs text-[#f6ead0]">
          <span>{phaseText}</span>
          <span className="shrink-0 font-mono text-[11px] text-[#e3b866]">
            Step {curStep}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Side-by-Side Live SVG Prefix Trie (L->R) & Reversed Suffix Trie (R<-L) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TrieSvgPane
          title="Prefix Trie"
          subtitle={fullCatalog ? '3,000 books L→R (showing active walk + neighbors)' : 'Stores words left-to-right (catdog → c → a → t → …)'}
          direction="ltr"
          root={prefixDisplay.root}
          walkSteps={trace.prefixSteps}
          activeWalkCount={activePrefixWalk}
          accent="gold"
          selectedNode={selectedNode}
          onSelectNode={(node) => {
            setShowAllIds(false)
            setSelectedNode({ tree: 'prefix', node: prefixDisplay.realById?.get(node.id) ?? node })
          }}
          words={activeWords as string[]}
          expanded={expanded}
        />
        <TrieSvgPane
          title="Reversed Suffix Trie"
          subtitle={fullCatalog ? '3,000 books R←L (showing active walk + neighbors)' : 'Stores reversed words right-to-left (catdog → g → o → d → …)'}
          direction="rtl"
          root={suffixDisplay.root}
          walkSteps={trace.suffixSteps}
          activeWalkCount={activeSuffixWalk}
          accent="teal"
          selectedNode={selectedNode}
          onSelectNode={(node) => {
            setShowAllIds(false)
            setSelectedNode({ tree: 'suffix', node: suffixDisplay.realById?.get(node.id) ?? node })
          }}
          words={activeWords as string[]}
          expanded={expanded}
        />
      </div>

      {/* Clickable TrieNode Sorted recordIds Inspector */}
      {selectedNode && (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e3b866]">
              Clicked TrieNode · {selectedNode.tree === 'prefix' ? 'Prefix Trie (L→R)' : 'Reversed Suffix Trie (R←L)'} · Node #{selectedNode.node.id}
            </div>
            <div className="font-mono text-[11px] text-[#f1e4c8]/70">
              char: '{selectedNode.node.char}' · depth: {selectedNode.node.depth} · path:{' '}
              {selectedNode.node.depth === 0
                ? 'ROOT'
                : selectedNode.tree === 'prefix'
                  ? `"${selectedNode.node.path}"`
                  : `"${selectedNode.node.path}" (suffix "${selectedNode.node.path.split('').reverse().join('')}")`}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#f1e4c8]/60">Full sorted recordIds ({selectedNode.node.recordIds.length}):</span>
            {(showAllIds ? selectedNode.node.recordIds : selectedNode.node.recordIds.slice(-40)).map((id) => (
              <span
                key={id}
                className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                  trace.bestId === id && curStep >= totalSteps
                    ? 'border-[#e3b866] bg-[#e3b866]/20 text-white'
                    : 'border-white/12 bg-white/[0.05] text-[#f1e4c8]/85'
                }`}
              >
                #{id} ({titleCase(activeWords[id])})
              </span>
            ))}
            {!showAllIds && selectedNode.node.recordIds.length > 40 && (
              <button
                onClick={() => setShowAllIds(true)}
                className="rounded-md border border-[#e3b866]/40 bg-[#e3b866]/10 px-2 py-0.5 text-[11px] font-medium text-[#f0cf86] hover:bg-[#e3b866]/20"
              >
                Show all {selectedNode.node.recordIds.length} IDs
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Two-Pointer Step Table */}
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#e3b866]">
            <ArrowLeftRight size={14} /> Live Two-Pointer Intersection (Sorted recordIds)
          </div>
          <div className="text-[11px] text-[#f1e4c8]/60">
            Starts at the <b>highest index</b> of both sorted arrays so the <b>largest matching ID</b> is found first.
          </div>
        </div>

        {/* Live pointer arrays */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e3b866]/25 bg-black/30 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#f0cf86]">Prefix Node recordIds ({trace.pIds.length})</span>
              <span className="font-mono text-[#f1e4c8]/60">
                i = {currentTp ? currentTp.pIndex : trace.pIds.length - 1}
              </span>
            </div>
            {trace.pIds.length === 0 ? (
              <div className="text-xs text-red-300/80">Prefix not found in Prefix Trie (empty)</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const ptr = currentTp ? Math.max(0, currentTp.pIndex) : trace.pIds.length - 1
                  const start = Math.max(0, ptr - 14)
                  const end = Math.min(trace.pIds.length, start + 24)
                  return (
                    <>
                      {start > 0 && <span className="self-center font-mono text-[10px] text-[#f1e4c8]/45">+{start} earlier…</span>}
                      {trace.pIds.slice(start, end).map((id, off) => {
                        const idx = start + off
                        const isPtr = currentTp ? currentTp.pIndex === idx : idx === trace.pIds.length - 1
                        const isMatched = currentTp ? currentTp.matchedSoFar.includes(id) : false
                        return (
                          <div
                            key={`${id}-${idx}`}
                            className={`flex flex-col items-center rounded-lg border px-2 py-1 font-mono text-xs ${
                              isPtr
                                ? 'border-[#e3b866] bg-[#e3b866]/25 text-white ring-1 ring-[#e3b866]'
                                : isMatched
                                  ? 'border-[#6fd3c4]/50 bg-[#6fd3c4]/15 text-[#8fe3d6]'
                                  : 'border-white/10 bg-white/[0.04] text-[#f1e4c8]/75'
                            }`}
                          >
                            <span className="text-[9px] text-[#f1e4c8]/50">[{idx}]{isPtr ? ' ← i' : ''}</span>
                            <span className="font-bold">#{id}</span>
                          </div>
                        )
                      })}
                      {end < trace.pIds.length && <span className="self-center font-mono text-[10px] text-[#f1e4c8]/45">+{trace.pIds.length - end} more</span>}
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#6fd3c4]/25 bg-black/30 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#8fe3d6]">Reversed Suffix Node recordIds ({trace.sIds.length})</span>
              <span className="font-mono text-[#f1e4c8]/60">
                j = {currentTp ? currentTp.sIndex : trace.sIds.length - 1}
              </span>
            </div>
            {trace.sIds.length === 0 ? (
              <div className="text-xs text-red-300/80">Suffix not found in Reversed Suffix Trie (empty)</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(() => {
                  const ptr = currentTp ? Math.max(0, currentTp.sIndex) : trace.sIds.length - 1
                  const start = Math.max(0, ptr - 14)
                  const end = Math.min(trace.sIds.length, start + 24)
                  return (
                    <>
                      {start > 0 && <span className="self-center font-mono text-[10px] text-[#f1e4c8]/45">+{start} earlier…</span>}
                      {trace.sIds.slice(start, end).map((id, off) => {
                        const idx = start + off
                        const isPtr = currentTp ? currentTp.sIndex === idx : idx === trace.sIds.length - 1
                        const isMatched = currentTp ? currentTp.matchedSoFar.includes(id) : false
                        return (
                          <div
                            key={`${id}-${idx}`}
                            className={`flex flex-col items-center rounded-lg border px-2 py-1 font-mono text-xs ${
                              isPtr
                                ? 'border-[#6fd3c4] bg-[#6fd3c4]/25 text-white ring-1 ring-[#6fd3c4]'
                                : isMatched
                                  ? 'border-[#6fd3c4]/50 bg-[#6fd3c4]/15 text-[#8fe3d6]'
                                  : 'border-white/10 bg-white/[0.04] text-[#f1e4c8]/75'
                            }`}
                          >
                            <span className="text-[9px] text-[#f1e4c8]/50">[{idx}]{isPtr ? ' ← j' : ''}</span>
                            <span className="font-bold">#{id}</span>
                          </div>
                        )
                      })}
                      {end < trace.sIds.length && <span className="self-center font-mono text-[10px] text-[#f1e4c8]/45">+{trace.sIds.length - end} more</span>}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Step table */}
        <div className="scroll-thin overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[540px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-[10.5px] uppercase tracking-wider text-[#e3b866]">
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">P[i]</th>
                <th className="px-3 py-2">S[j]</th>
                <th className="px-3 py-2">Compare</th>
                <th className="px-3 py-2">Pointer Action</th>
                <th className="px-3 py-2">Matches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {trace.pointerSteps.slice(0, 80).map((row, idx) => {
                const reached = idx < activePointerSteps
                const isCurrent = idx === activePointerSteps - 1
                return (
                  <tr
                    key={row.step}
                    onClick={() => {
                      setPlaying(false)
                      setStep(pLen + sLen + idx + 1)
                    }}
                    className={`cursor-pointer transition ${
                      isCurrent
                        ? 'bg-[#e3b866]/20 text-white'
                        : reached
                          ? 'bg-white/[0.02] text-[#f1e4c8]/85 hover:bg-white/[0.05]'
                          : 'text-[#f1e4c8]/30 hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="px-3 py-1.5">{row.step}</td>
                    <td className="px-3 py-1.5 text-[#f0cf86]">{row.pVal !== null ? `P[${row.pIndex}]=#${row.pVal}` : `i=${row.pIndex}`}</td>
                    <td className="px-3 py-1.5 text-[#8fe3d6]">{row.sVal !== null ? `S[${row.sIndex}]=#${row.sVal}` : `j=${row.sIndex}`}</td>
                    <td className="px-3 py-1.5">
                      {row.comparison === 'match' ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">P == S</span>
                      ) : row.comparison === 'p_greater' ? (
                        <span className="text-[#f0cf86]">P &gt; S</span>
                      ) : row.comparison === 's_greater' ? (
                        <span className="text-[#8fe3d6]">P &lt; S</span>
                      ) : (
                        <span className="text-[#f1e4c8]/60">DONE</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-sans text-[11.5px]">{row.action}</td>
                    <td className="px-3 py-1.5">{row.matchedSoFar.length > 0 ? `[${row.matchedSoFar.join(', ')}]` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
