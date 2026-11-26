import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Cpu, Gauge, Loader2, Maximize2, Minimize2, Server, Timer } from 'lucide-react'
import { BOOKS, DUPLICATE_TITLE_COUNT, TITLES, UNIQUE_TITLES, normalizeClue, searchBooks, titleCase, trie } from '../lib/catalog'
import { bruteForceLargestId } from '../lib/bruteforce'
import { PrefixSuffixTrie } from '../lib/trie'
import { useLibrary } from '../store'
import { Chip, PanelShell, Stat, btnGhost, btnGold, inputCls } from './common'
import { TraceLegend, TraceView } from './TraceView'
import { TrieVisualizer2D } from './TrieVisualizer2D'

function isPrefixOf(small: string, big: string): boolean {
  if (small.length > big.length) return false
  for (let i = 0; i < small.length; i++) if (small.charCodeAt(i) !== big.charCodeAt(i)) return false
  return true
}

interface Bench {
  n: number
  trieMs: number
  bruteMs: number
  mismatches: number
  hits: number
}

function runBenchmark(n: number): Bench {
  let seed = 987654321
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const P: string[] = []
  const S: string[] = []
  for (let i = 0; i < n; i++) {
    const t = TITLES[Math.floor(rnd() * TITLES.length)]
    const pl = 1 + Math.floor(rnd() * Math.min(4, t.length))
    const sl = 1 + Math.floor(rnd() * Math.min(4, t.length))
    P.push(t.slice(0, pl))
    S.push(t.slice(t.length - sl))
  }
  const a = new Int32Array(n)
  const b = new Int32Array(n)
  const t0 = performance.now()
  for (let i = 0; i < n; i++) a[i] = trie.largestId(P[i], S[i])
  const t1 = performance.now()
  for (let i = 0; i < n; i++) b[i] = bruteForceLargestId(TITLES, P[i], S[i])
  const t2 = performance.now()
  let mismatches = 0
  let hits = 0
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) mismatches++
    if (a[i] >= 0) hits++
  }
  return { n, trieMs: t1 - t0, bruteMs: t2 - t1, mismatches, hits }
}

type ServerState = { state: 'idle' } | { state: 'checking' } | { state: 'offline' } | { state: 'online'; books: number; nodes: number; agree: boolean; id: number; ms: number }

const SNIPPET = `// build: every word w is stored as L+1 wrapped keys
for (start = L; start >= 0; start--) {
  node = root
  for (k = start; k < L; k++) node = step(node, w[k])   // suffix part
  node = step(node, SEP, record = true)                  // the '{' separator
  for (k = 0; k < L; k++)   node = step(node, w[k], record = true)  // whole word
}   // 'record' pushes the book id to the head of the node's list

// query: ONE walk of  suffix + '{' + prefix   ->  O(|P| + |S|)
node = root
for (c of suffix) node = child(node, c)
node = child(node, SEP)
for (c of prefix) node = child(node, c)
return node ? headOf(node) /* largest id */ : -1`

export function AlgorithmPanel() {
  const close = useLibrary((s) => s.closePanel)
  const [word, setWord] = useState('catdog')
  const [p, setP] = useState('cat')
  const [s, setS] = useState('og')
  const [bench, setBench] = useState<Bench | null>(null)
  const [running, setRunning] = useState(false)
  const [n, setN] = useState(10000)
  const [server, setServer] = useState<ServerState>({ state: 'idle' })
  const [expanded, setExpanded] = useState(false)

  const stats = useMemo(() => trie.stats(), [])
  const keys = useMemo(() => PrefixSuffixTrie.wrappedKeys(normalizeClue(word) || 'a'), [word])
  const outcome = useMemo(() => searchBooks(p, s, 5), [p, s])
  const queryKey = outcome.suffix + '{' + outcome.prefix

  const start = () => {
    setRunning(true)
    setBench(null)
    setTimeout(() => {
      setBench(runBenchmark(n))
      setRunning(false)
    }, 60)
  }

  const ping = async () => {
    setServer({ state: 'checking' })
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 3000)
      const h = await fetch('/api/health', { signal: ctrl.signal })
      const hj = await h.json()
      const t0 = performance.now()
      const r = await fetch(`/api/search?prefix=${encodeURIComponent(outcome.prefix)}&suffix=${encodeURIComponent(outcome.suffix)}&limit=1`, { signal: ctrl.signal })
      const rj = await r.json()
      clearTimeout(timer)
      setServer({ state: 'online', books: hj.books, nodes: hj.nodes, id: rj.id, agree: rj.id === outcome.id && rj.count === outcome.count, ms: performance.now() - t0 })
    } catch {
      setServer({ state: 'offline' })
    }
  }

  return (
    <PanelShell
      title="Algorithm Explorer"
      subtitle="Interactive 2D Trie visualizer, step-by-step walkthrough & benchmark"
      icon={<Cpu size={20} />}
      onClose={close}
      wide
      full={expanded}
      headerAction={
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e3b866]/30 bg-[#e3b866]/10 px-3 text-xs font-medium text-[#f0cf86] transition hover:bg-[#e3b866]/20"
          title={expanded ? 'Return to side drawer' : 'Expand for presentation'}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden sm:inline">{expanded ? 'Compact' : 'Presenter View'}</span>
        </button>
      }
    >
      <div className="scroll-thin h-full space-y-6 overflow-y-auto px-5 pb-10 pt-4">
        {/* ------------------------------------------------------------ idea */}
        <section>
          <p className="text-[15px] leading-relaxed text-[#f1e4c8]/80">
            Finding a book that <b className="text-[#f0cf86]">starts with</b> one clue <i>and</i> <b className="text-[#8fe3d6]">ends with</b> another normally means scanning every title. This index answers in a single walk. Each word is stored under every <b>suffix + “{'{'}” + word</b> key; a
            query is just <b>suffix + “{'{'}” + prefix</b>.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Books" value={stats.books.toLocaleString()} hint={`${UNIQUE_TITLES.toLocaleString()} unique titles`} />
            <Stat label="Trie nodes" value={stats.nodes.toLocaleString()} hint={`${stats.entries.toLocaleString()} id entries`} />
            <Stat label="Build time" value={`${stats.buildMs.toFixed(0)} ms`} hint={`${(stats.usedBytes / 1048576).toFixed(1)} MB typed arrays`} />
            <Stat label="Duplicates" value={DUPLICATE_TITLE_COUNT} hint="titles with several IDs" />
          </div>
        </section>

        {/* ----------------------------------------- 2D interactive tree */}
        <TrieVisualizer2D expanded={expanded} />

        {/* --------------------------------------------------- wrapped keys */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-display text-xl font-semibold text-[#f6e7c3]">Full Catalog · Wrapped keys</h3>
          <p className="mt-1 text-[13px] text-[#f1e4c8]/60">Type a word to see the {keys.length} keys it adds. Keys that the query below would match are highlighted.</p>
          <div className="mt-3 flex items-center gap-2">
            <input value={word} onChange={(e) => setWord(normalizeClue(e.target.value).slice(0, 8))} className={inputCls + ' max-w-[220px] font-mono tracking-widest'} aria-label="Word to insert" spellCheck={false} />
            <Chip tone="plain">{keys.length} keys = length + 1</Chip>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keys.map((k) => {
              const hit = isPrefixOf(queryKey, k)
              return (
                <motion.span key={k} layout className={`rounded-lg border px-2.5 py-1 font-mono text-[13px] ${hit ? 'border-[#e3b866] bg-[#e3b866]/20 text-white' : 'border-white/10 bg-white/[0.04] text-[#f1e4c8]/70'}`}>
                  {k.split('{')[0]}
                  <span className="text-[#e3b866]">{'{'}</span>
                  {k.split('{')[1]}
                </motion.span>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] text-[#f1e4c8]/50">
            Query key <span className="font-mono text-[#f6e7c3]">{queryKey}</span> {keys.some((k) => isPrefixOf(queryKey, k)) ? 'is a prefix of the highlighted key, so this word matches.' : 'is not a prefix of any key of this word.'}
          </p>
        </section>

        {/* ------------------------------------------------------------ walk */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-display text-xl font-semibold text-[#f6e7c3]">2 · Query: one walk</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0cf86]">Prefix</span>
              <input value={p} onChange={(e) => setP(normalizeClue(e.target.value).slice(0, 8))} className={inputCls + ' font-mono tracking-widest'} spellCheck={false} aria-label="Prefix" />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fe3d6]">Suffix</span>
              <input value={s} onChange={(e) => setS(normalizeClue(e.target.value).slice(0, 8))} className={inputCls + ' font-mono tracking-widest'} spellCheck={false} aria-label="Suffix" />
            </label>
          </div>
          <div className="mt-4">
            <TraceView trace={outcome.trace} />
          </div>
          <div className="mt-2">
            <TraceLegend />
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
            {outcome.id >= 0 ? (
              <span>
                <Check size={15} className="mr-1.5 inline text-[#8fe3d6]" />
                Walked <b>{outcome.trace.edgesWalked}</b> edges in <b>{outcome.micros.toFixed(0)} µs</b> → <b className="text-[#f0cf86]">{titleCase(BOOKS[outcome.id].title)}</b> (ID {outcome.id}), the largest of <b>{outcome.count}</b> matching {outcome.count === 1 ? 'book' : 'books'}.
              </span>
            ) : (
              <span>
                The walk stopped after <b>{outcome.trace.edgesWalked}</b> of {outcome.trace.steps.length} edges: nothing in the catalog begins with “{outcome.prefix}” and ends with “{outcome.suffix}”.
              </span>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------- benchmark */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-display text-xl font-semibold text-[#f6e7c3]">3 · Benchmark vs. naive scan</h3>
          <p className="mt-1 text-[13px] text-[#f1e4c8]/60">The same seeded queries are answered by the Trie and by a plain loop over all 3,000 titles. The naive loop is only a verification baseline; it is never used for real searches.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[2000, 10000, 50000].map((v) => (
              <button key={v} onClick={() => setN(v)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${n === v ? 'border-[#e3b866] bg-[#e3b866]/20 text-white' : 'border-white/12 text-[#f1e4c8]/70 hover:bg-white/10'}`}>
                {v.toLocaleString()} queries
              </button>
            ))}
            <button onClick={start} disabled={running} className={btnGold + ' ml-auto'}>
              {running ? <Loader2 size={16} className="animate-spin" /> : <Gauge size={16} />} Run benchmark
            </button>
          </div>
          {bench && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
              {[
                { label: 'Prefix–suffix Trie', ms: bench.trieMs, color: 'from-[#f0cf86] to-[#b98a3e]' },
                { label: 'Naive scan (baseline)', ms: bench.bruteMs, color: 'from-[#8a8a8a] to-[#555]' },
              ].map((row) => {
                const max = Math.max(bench.trieMs, bench.bruteMs, 0.001)
                return (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-xs text-[#f1e4c8]/70">
                      <span>{row.label}</span>
                      <span className="font-mono">
                        {row.ms.toFixed(2)} ms · {Math.round(bench.n / Math.max(row.ms / 1000, 1e-6)).toLocaleString()} q/s
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(1.5, (row.ms / max) * 100)}%` }} transition={{ duration: 0.8 }} className={`h-full rounded-full bg-gradient-to-r ${row.color}`} />
                    </div>
                  </div>
                )
              })}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Speed-up" value={`×${(bench.bruteMs / Math.max(bench.trieMs, 0.001)).toFixed(0)}`} />
                <Stat label="Queries with a hit" value={`${Math.round((bench.hits / bench.n) * 100)}%`} />
                <Stat label="Disagreements" value={bench.mismatches} hint={bench.mismatches === 0 ? 'identical answers' : 'investigate!'} />
              </div>
            </motion.div>
          )}
        </section>

        {/* ------------------------------------------------------ complexity */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-display text-xl font-semibold text-[#f6e7c3]">4 · Complexity</h3>
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 text-sm">
            {[
              ['Query (prefix P, suffix S)', 'O(|P| + |S|)', 'independent of the 3,000 books'],
              ['Insert one title of length L', 'O((L + 1)²)', 'L ≤ 8, so at most 81 edge steps'],
              ['Memory', 'O(Σ (L + 1)²)', `${stats.nodes.toLocaleString()} nodes in flat typed arrays`],
              ['Listing k matches', 'O(|P| + |S| + k)', 'ids come out already in descending order'],
              ['Naive scan', 'O(N · L)', 'what the Trie avoids'],
            ].map((r, i) => (
              <div key={r[0]} className={`grid grid-cols-[1.4fr_1fr] gap-x-3 px-3.5 py-2.5 sm:grid-cols-[1.4fr_1fr_1.6fr] ${i % 2 ? 'bg-white/[0.03]' : ''}`}>
                <span className="text-[#f1e4c8]/85">{r[0]}</span>
                <span className="font-mono text-[#f0cf86]">{r[1]}</span>
                <span className="col-span-2 text-xs text-[#f1e4c8]/50 sm:col-span-1">{r[2]}</span>
              </div>
            ))}
          </div>
          <pre className="scroll-thin mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-[#d9ccb0]">{SNIPPET}</pre>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-[#f1e4c8]/65">
            <li>
              <b>Tie-break:</b> several books can match. IDs are assigned in insertion order and each node keeps its ids newest-first, so the head is always the largest ID.
            </li>
            <li>
              <b>Duplicates</b> are distinct entries with distinct IDs, so a title stored 3 times counts 3 times.
            </li>
            <li>
              <b>Exact counts:</b> the separator sits at a different depth in each of a word’s keys, so a word can reach a node only once.
            </li>
          </ul>
        </section>

        {/* ---------------------------------------------------------- server */}
        <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="font-display text-xl font-semibold text-[#f6e7c3]">5 · Express backend</h3>
          <p className="mt-1 text-[13px] text-[#f1e4c8]/60">
            The same Trie class also runs inside a small Express server (<code className="text-[#f0cf86]">npx tsx server/index.ts</code>). The browser app never depends on it; this check just compares answers when it is reachable.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={ping} className={btnGhost} disabled={server.state === 'checking'}>
              {server.state === 'checking' ? <Loader2 size={15} className="animate-spin" /> : <Server size={15} />} Check API for “{outcome.prefix}” … “{outcome.suffix}”
            </button>
            {server.state === 'online' && (
              <span className={`flex items-center gap-1.5 text-sm ${server.agree ? 'text-[#8fe3d6]' : 'text-red-300'}`}>
                <Timer size={14} /> online · {server.books} books · {server.nodes.toLocaleString()} nodes · {server.agree ? 'same answer as the browser' : 'DIFFERENT answer!'} ({server.ms.toFixed(0)} ms round trip)
              </span>
            )}
            {server.state === 'offline' && <span className="text-sm text-[#f1e4c8]/55">API not reachable (static hosting). Everything above still runs fully in your browser.</span>}
          </div>
        </section>
      </div>
    </PanelShell>
  )
}
