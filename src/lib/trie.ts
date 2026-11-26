/* ============================================================================
 *  PrefixSuffixTrie  –  a reusable prefix + suffix retrieval index
 *  ----------------------------------------------------------------------------
 *  Written from scratch. No Array.filter / find / findLast, no String.includes,
 *  no regular expressions, no third-party search or trie libraries, no sorting and
 *  no linear scan of the catalog at query time.
 *
 *  IDEA  ("suffix-wrapped keys")
 *  ----------------------------------------------------------------------------
 *  For a word w = w0 w1 … w(L-1) we insert L+1 keys into ONE trie:
 *
 *        w[i..L-1] + SEP + w         for i = L, L-1, …, 0
 *
 *  e.g. "catdog"  →  "{catdog", "g{catdog", "og{catdog", "dog{catdog", …
 *
 *  A query (prefix P, suffix S) becomes the single key  S + SEP + P.
 *  Because SEP occurs exactly once in every key, the key  S + SEP + P  is a
 *  trie-prefix of "w[i..] + SEP + w"  iff  w ends with S  AND  w starts with P.
 *  So the whole question is answered with ONE walk of |S|+1+|P| edges:
 *
 *        query time  O(|P| + |S|)          (independent of the catalog size)
 *        build time  O(Σ (L+1)²)           (L ≤ 8 → at most 81 edge-steps / word)
 *        space       O(Σ (L+1)²) nodes     (flat typed arrays, no per-node objects)
 *
 *  Every node AFTER the separator stores the list of matching book IDs. Because IDs
 *  are assigned in insertion order (0,1,2,…) and every node's list is built by
 *  "push to head", the head is always the LARGEST id and walking the list yields the
 *  ids in descending order – no sorting needed, ever.
 *
 *  Why the count is exact: the SEP sits at a different depth for every one of a
 *  word's L+1 keys, therefore a word can reach a given post-SEP node at most once.
 * ========================================================================== */

const SEP = 26 // index of the separator edge (letters use 0..25)
const WIDTH = 27 // 26 letters + separator
const A = 97

export interface TraceStep {
  /** the character walked ('{' is displayed for the separator) */
  char: string
  /** true for the separator edge */
  isSeparator: boolean
  /** which part of the query the char belongs to */
  part: 'suffix' | 'separator' | 'prefix'
  /** number of books matching everything walked so far (only meaningful after SEP) */
  count: number | null
  /** the largest id matching so far (only meaningful after SEP) */
  maxId: number | null
  /** did the edge exist? */
  ok: boolean
  /** source node index before walking this edge (-1 if already stopped) */
  fromNodeId: number
  /** destination node index after walking this edge (-1 if missing) */
  nodeId: number
}

export interface InspectedEdge {
  char: string
  code: number
  isSeparator: boolean
  to: number
}

export interface InspectedNode {
  id: number
  parent: number
  viaChar: string
  depth: number
  zone: 'root' | 'suffix' | 'separator' | 'prefix'
  count: number
  headEntry: number
  ids: number[]
  edges: InspectedEdge[]
}

export interface InspectedTrie {
  nodes: InspectedNode[]
  entryId: number[]
  entryNext: number[]
  nodeTotal: number
  entryTotal: number
  truncated: boolean
}

export interface InsertEdgeTrace {
  from: number
  to: number
  char: string
  isSeparator: boolean
  part: 'suffix' | 'separator' | 'prefix'
  created: boolean
  recorded: boolean
  count: number | null
  maxId: number | null
}

export interface QueryTrace {
  prefix: string
  suffix: string
  key: string
  steps: TraceStep[]
  /** number of edges successfully walked */
  edgesWalked: number
  complete: boolean
}

export interface TrieStats {
  books: number
  nodes: number
  entries: number
  edgesInserted: number
  buildMs: number
  /** bytes really used by the typed arrays */
  usedBytes: number
  /** bytes allocated (capacity) */
  allocatedBytes: number
}

export interface SearchHit {
  /** largest matching insertion id, or -1 when nothing matches */
  id: number
  /** exact number of matching books (duplicates count separately) */
  count: number
  /** trie edges walked (≤ |prefix| + |suffix| + 1) */
  edges: number
}

function code(str: string, i: number): number {
  const c = str.charCodeAt(i) - A
  return c >= 0 && c < 26 ? c : -1
}

export class PrefixSuffixTrie {
  private children: Int32Array
  private counts: Int32Array
  private heads: Int32Array
  private entryId: Int32Array
  private entryNext: Int32Array
  private nodeCap: number
  private entryCap: number
  private nodeTotal = 1 // node 0 is the root
  private entryTotal = 0
  private bookTotal = 0
  private edgeSteps = 0
  private buildTime = 0

  constructor(initialNodes = 1 << 14, initialEntries = 1 << 14) {
    this.nodeCap = initialNodes
    this.entryCap = initialEntries
    this.children = new Int32Array(this.nodeCap * WIDTH)
    this.counts = new Int32Array(this.nodeCap)
    this.heads = new Int32Array(this.nodeCap).fill(-1)
    this.entryId = new Int32Array(this.entryCap)
    this.entryNext = new Int32Array(this.entryCap)
  }

  /** number of books inserted (= next insertion id) */
  get size(): number {
    return this.bookTotal
  }

  // ------------------------------------------------------------------ build --

  /**
   * Insert a lowercase word. The index assigns the insertion id itself
   * (0, 1, 2, …) and returns it. Duplicates are allowed – each gets its own id.
   */
  insert(word: string): number {
    const L = word.length
    if (L < 1) throw new Error('empty title')
    for (let i = 0; i < L; i++) if (code(word, i) < 0) throw new Error('title must contain only a-z: ' + word)

    const t0 = typeof performance !== 'undefined' ? performance.now() : 0
    const id = this.bookTotal++
    for (let start = L; start >= 0; start--) {
      let node = 0
      for (let k = start; k < L; k++) node = this.step(node, code(word, k), false, id)
      node = this.step(node, SEP, true, id)
      for (let k = 0; k < L; k++) node = this.step(node, code(word, k), true, id)
    }
    if (typeof performance !== 'undefined') this.buildTime += performance.now() - t0
    return id
  }

  private step(node: number, c: number, record: boolean, id: number): number {
    const slot = node * WIDTH + c
    let child = this.children[slot]
    if (child === 0) {
      if (this.nodeTotal === this.nodeCap) this.growNodes()
      child = this.nodeTotal++
      this.children[slot] = child
    }
    this.edgeSteps++
    if (record) {
      if (this.entryTotal === this.entryCap) this.growEntries()
      const e = this.entryTotal++
      this.entryId[e] = id
      this.entryNext[e] = this.heads[child]
      this.heads[child] = e
      this.counts[child]++
    }
    return child
  }

  private growNodes(): void {
    const cap = this.nodeCap * 2
    const children = new Int32Array(cap * WIDTH)
    children.set(this.children)
    const counts = new Int32Array(cap)
    counts.set(this.counts)
    const heads = new Int32Array(cap).fill(-1)
    heads.set(this.heads)
    this.children = children
    this.counts = counts
    this.heads = heads
    this.nodeCap = cap
  }

  private growEntries(): void {
    const cap = this.entryCap * 2
    const ids = new Int32Array(cap)
    ids.set(this.entryId)
    const next = new Int32Array(cap)
    next.set(this.entryNext)
    this.entryId = ids
    this.entryNext = next
    this.entryCap = cap
  }

  // ------------------------------------------------------------------ query --

  /** Walk S + SEP + P. Returns the node index or -1. O(|P| + |S|). */
  private locate(prefix: string, suffix: string): number {
    let node = 0
    for (let i = 0; i < suffix.length; i++) {
      const c = code(suffix, i)
      if (c < 0) return -1
      node = this.children[node * WIDTH + c]
      if (node === 0) return -1
    }
    node = this.children[node * WIDTH + SEP]
    if (node === 0) return -1
    for (let i = 0; i < prefix.length; i++) {
      const c = code(prefix, i)
      if (c < 0) return -1
      node = this.children[node * WIDTH + c]
      if (node === 0) return -1
    }
    return node
  }

  /**
   * Largest insertion id of a book that starts with `prefix` AND ends with
   * `suffix`, or -1. Either clue may be the empty string (= "anything").
   */
  search(prefix: string, suffix: string): SearchHit {
    const node = this.locate(prefix, suffix)
    const edges = prefix.length + suffix.length + 1
    if (node < 0) return { id: -1, count: 0, edges }
    return { id: this.entryId[this.heads[node]], count: this.counts[node], edges }
  }

  /** Just the answer of the classic "largest id" rule. */
  largestId(prefix: string, suffix: string): number {
    const node = this.locate(prefix, suffix)
    return node < 0 ? -1 : this.entryId[this.heads[node]]
  }

  /** Exact number of books matching both clues. */
  countMatches(prefix: string, suffix: string): number {
    const node = this.locate(prefix, suffix)
    return node < 0 ? 0 : this.counts[node]
  }

  /**
   * Matching ids in DESCENDING order (largest first), `offset`-th onwards, at most
   * `limit` of them. Cost O(|P| + |S| + offset + limit). Nothing is sorted.
   */
  matches(prefix: string, suffix: string, limit = 50, offset = 0): number[] {
    const out: number[] = []
    const node = this.locate(prefix, suffix)
    if (node < 0) return out
    let e = this.heads[node]
    let skipped = 0
    while (e !== -1 && out.length < limit) {
      if (skipped < offset) skipped++
      else out.push(this.entryId[e])
      e = this.entryNext[e]
    }
    return out
  }

  /** Step-by-step walk, used by the Algorithm Explorer visualisation. */
  trace(prefix: string, suffix: string): QueryTrace {
    const steps: TraceStep[] = []
    let node = 0
    let alive = true
    let walked = 0
    const total = suffix.length + 1 + prefix.length
    for (let n = 0; n < total; n++) {
      let c: number
      let ch: string
      let part: TraceStep['part']
      if (n < suffix.length) {
        c = code(suffix, n)
        ch = suffix.charAt(n)
        part = 'suffix'
      } else if (n === suffix.length) {
        c = SEP
        ch = '{'
        part = 'separator'
      } else {
        const j = n - suffix.length - 1
        c = code(prefix, j)
        ch = prefix.charAt(j)
        part = 'prefix'
      }
      const prevNode = alive ? node : -1
      let ok = false
      if (alive && c >= 0) {
        const next = this.children[node * WIDTH + c]
        if (next !== 0) {
          node = next
          ok = true
          walked++
        }
      }
      if (!ok) alive = false
      const afterSep = n >= suffix.length
      steps.push({
        char: ch,
        isSeparator: part === 'separator',
        part,
        count: ok && afterSep ? this.counts[node] : null,
        maxId: ok && afterSep ? this.entryId[this.heads[node]] : null,
        ok,
        fromNodeId: prevNode,
        nodeId: ok ? node : -1,
      })
    }
    return { prefix, suffix, key: suffix + '{' + prefix, steps, edgesWalked: walked, complete: alive }
  }

  /** Allocate the next sequential book ID for step-by-step teaching insertions. */
  allocBookId(): number {
    return this.bookTotal++
  }

  /** Insert one wrapped key `word[start..] + '{' + word` and return its edge-by-edge trace. */
  insertSingleWrappedKey(word: string, start: number, id: number): InsertEdgeTrace[] {
    const L = word.length
    if (L < 1) throw new Error('empty title')
    for (let i = 0; i < L; i++) if (code(word, i) < 0) throw new Error('title must contain only a-z: ' + word)
    const trace: InsertEdgeTrace[] = []
    let node = 0
    const pushStep = (c: number, ch: string, isSeparator: boolean, part: InsertEdgeTrace['part'], record: boolean) => {
      const before = this.nodeTotal
      const next = this.step(node, c, record, id)
      const created = this.nodeTotal > before
      trace.push({
        from: node,
        to: next,
        char: ch,
        isSeparator,
        part,
        created,
        recorded: record,
        count: record ? this.counts[next] : null,
        maxId: record ? this.entryId[this.heads[next]] : null,
      })
      node = next
    }
    for (let k = start; k < L; k++) pushStep(code(word, k), word.charAt(k), false, 'suffix', false)
    pushStep(SEP, '{', true, 'separator', true)
    for (let k = 0; k < L; k++) pushStep(code(word, k), word.charAt(k), false, 'prefix', true)
    return trace
  }

  /** Read-only BFS snapshot of the real typed-array Trie for 2D tree visualization. */
  inspect(maxNodes = 600): InspectedTrie {
    const nodes: InspectedNode[] = []
    const queue: { id: number; parent: number; viaChar: string; depth: number; zone: InspectedNode['zone'] }[] = [
      { id: 0, parent: -1, viaChar: 'root', depth: 0, zone: 'root' },
    ]
    let qHead = 0
    let truncated = false

    while (qHead < queue.length) {
      const cur = queue[qHead++]
      if (nodes.length >= maxNodes) {
        truncated = true
        break
      }
      const ids: number[] = []
      let e = this.heads[cur.id]
      while (e !== -1) {
        ids.push(this.entryId[e])
        e = this.entryNext[e]
      }
      const edges: InspectedEdge[] = []
      const base = cur.id * WIDTH
      // Visit separator '{' first, then a-z in order for clean layout
      const sepChild = this.children[base + SEP]
      if (sepChild !== 0) {
        edges.push({ char: '{', code: SEP, isSeparator: true, to: sepChild })
        queue.push({ id: sepChild, parent: cur.id, viaChar: '{', depth: cur.depth + 1, zone: 'separator' })
      }
      for (let c = 0; c < 26; c++) {
        const child = this.children[base + c]
        if (child !== 0) {
          const ch = String.fromCharCode(A + c)
          const nextZone: InspectedNode['zone'] = cur.zone === 'separator' || cur.zone === 'prefix' ? 'prefix' : 'suffix'
          edges.push({ char: ch, code: c, isSeparator: false, to: child })
          queue.push({ id: child, parent: cur.id, viaChar: ch, depth: cur.depth + 1, zone: nextZone })
        }
      }
      nodes.push({
        id: cur.id,
        parent: cur.parent,
        viaChar: cur.viaChar,
        depth: cur.depth,
        zone: cur.zone,
        count: this.counts[cur.id],
        headEntry: this.heads[cur.id],
        ids,
        edges,
      })
    }

    const entryId: number[] = []
    const entryNext: number[] = []
    for (let i = 0; i < this.entryTotal; i++) {
      entryId.push(this.entryId[i])
      entryNext.push(this.entryNext[i])
    }
    return { nodes, entryId, entryNext, nodeTotal: this.nodeTotal, entryTotal: this.entryTotal, truncated }
  }

  /** The L+1 wrapped keys that insert(word) stores (for teaching / visualisation). */
  static wrappedKeys(word: string): string[] {
    const keys: string[] = []
    for (let start = word.length; start >= 0; start--) {
      let tail = ''
      for (let k = start; k < word.length; k++) tail += word.charAt(k)
      keys.push(tail + '{' + word)
    }
    return keys
  }

  stats(): TrieStats {
    const usedBytes = this.nodeTotal * WIDTH * 4 + this.nodeTotal * 8 + this.entryTotal * 8
    const allocatedBytes = this.children.byteLength + this.counts.byteLength + this.heads.byteLength + this.entryId.byteLength + this.entryNext.byteLength
    return {
      books: this.bookTotal,
      nodes: this.nodeTotal,
      entries: this.entryTotal,
      edgesInserted: this.edgeSteps,
      buildMs: this.buildTime,
      usedBytes,
      allocatedBytes,
    }
  }
}
