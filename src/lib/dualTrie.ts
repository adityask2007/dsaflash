/* ============================================================================
 *  DualTrie  –  Forward Prefix Trie + Reversed Suffix Trie with TrieNode
 *  ----------------------------------------------------------------------------
 *  Used by the 2D Interactive Algorithm Visualizer to demonstrate:
 *   1. Prefix Trie (left-to-right characters) storing sorted recordIds
 *   2. Reversed Suffix Trie (right-to-left characters) storing sorted recordIds
 *   3. Two-pointer intersection over both nodes' sorted recordIds arrays
 *      (starting from the highest indices to find the largest common ID first).
 * ========================================================================== */

export class TrieNode {
  readonly id: number
  readonly char: string
  readonly depth: number
  readonly parent: TrieNode | null
  readonly path: string
  readonly children: Map<string, TrieNode> = new Map()
  /** Insertion IDs passing through this node, naturally sorted ascending (0, 1, 2, …) */
  readonly recordIds: number[] = []

  constructor(id: number, char: string, depth: number, parent: TrieNode | null, path: string) {
    this.id = id
    this.char = char
    this.depth = depth
    this.parent = parent
    this.path = path
  }
}

export interface WalkStep {
  tree: 'prefix' | 'suffix'
  char: string
  ok: boolean
  fromNode: TrieNode | null
  toNode: TrieNode | null
}

export interface TwoPointerStep {
  step: number
  pIndex: number
  sIndex: number
  pVal: number | null
  sVal: number | null
  comparison: 'match' | 'p_greater' | 's_greater' | 'done'
  action: string
  matchedSoFar: number[]
  bestId: number
}

export interface DualTrieTrace {
  prefix: string
  suffix: string
  reversedSuffix: string
  prefixSteps: WalkStep[]
  suffixSteps: WalkStep[]
  prefixNode: TrieNode | null
  suffixNode: TrieNode | null
  pIds: readonly number[]
  sIds: readonly number[]
  pointerSteps: TwoPointerStep[]
  matches: number[]
  bestId: number
}

export class DualTrie {
  readonly prefixRoot: TrieNode
  readonly suffixRoot: TrieNode
  private nextNodeId = 1
  readonly words: string[] = []

  constructor() {
    this.prefixRoot = new TrieNode(0, 'ROOT', 0, null, '')
    this.suffixRoot = new TrieNode(this.nextNodeId++, 'ROOT', 0, null, '')
  }

  private allocNode(char: string, depth: number, parent: TrieNode, path: string): TrieNode {
    return new TrieNode(this.nextNodeId++, char, depth, parent, path)
  }

  /** Insert a lowercase word into both the L->R Prefix Trie and R->L Reversed Suffix Trie. */
  insert(word: string): number {
    const id = this.words.length
    this.words.push(word)

    // 1) Forward Prefix Trie (left -> right)
    let pNode = this.prefixRoot
    pNode.recordIds.push(id)
    for (let i = 0; i < word.length; i++) {
      const ch = word.charAt(i)
      let child = pNode.children.get(ch)
      if (!child) {
        child = this.allocNode(ch, pNode.depth + 1, pNode, pNode.path + ch)
        pNode.children.set(ch, child)
      }
      pNode = child
      pNode.recordIds.push(id)
    }

    // 2) Reversed Suffix Trie (right -> left)
    let sNode = this.suffixRoot
    sNode.recordIds.push(id)
    for (let i = word.length - 1; i >= 0; i--) {
      const ch = word.charAt(i)
      let child = sNode.children.get(ch)
      if (!child) {
        child = this.allocNode(ch, sNode.depth + 1, sNode, sNode.path + ch)
        sNode.children.set(ch, child)
      }
      sNode = child
      sNode.recordIds.push(id)
    }

    return id
  }

  /** Walk Prefix Trie (L->R), Reversed Suffix Trie (R->L), and trace two-pointer merge. */
  traceQuery(prefix: string, suffix: string): DualTrieTrace {
    const prefixSteps: WalkStep[] = []
    let pCur: TrieNode | null = this.prefixRoot
    for (let i = 0; i < prefix.length; i++) {
      const ch = prefix.charAt(i)
      if (!pCur) {
        prefixSteps.push({ tree: 'prefix', char: ch, ok: false, fromNode: null, toNode: null })
        continue
      }
      const next: TrieNode | null = pCur.children.get(ch) ?? null
      prefixSteps.push({ tree: 'prefix', char: ch, ok: next !== null, fromNode: pCur, toNode: next })
      pCur = next
    }

    const suffixSteps: WalkStep[] = []
    let sCur: TrieNode | null = this.suffixRoot
    let reversedSuffix = ''
    for (let i = suffix.length - 1; i >= 0; i--) {
      const ch = suffix.charAt(i)
      reversedSuffix += ch
      if (!sCur) {
        suffixSteps.push({ tree: 'suffix', char: ch, ok: false, fromNode: null, toNode: null })
        continue
      }
      const next: TrieNode | null = sCur.children.get(ch) ?? null
      suffixSteps.push({ tree: 'suffix', char: ch, ok: next !== null, fromNode: sCur, toNode: next })
      sCur = next
    }

    const pIds = pCur ? pCur.recordIds : []
    const sIds = sCur ? sCur.recordIds : []
    const pointerSteps: TwoPointerStep[] = []
    const matches: number[] = []

    // Two pointers starting at the end of both ascending sorted arrays -> finds largest ID first
    let i = pIds.length - 1
    let j = sIds.length - 1
    let stepNum = 1
    while (i >= 0 && j >= 0) {
      const pv = pIds[i]
      const sv = sIds[j]
      if (pv === sv) {
        matches.push(pv)
        pointerSteps.push({
          step: stepNum++,
          pIndex: i,
          sIndex: j,
          pVal: pv,
          sVal: sv,
          comparison: 'match',
          action: `P[${i}] (${pv}) == S[${j}] (${sv}) → MATCH! Record #${pv}, move both i--, j--`,
          matchedSoFar: [...matches],
          bestId: matches[0],
        })
        i--
        j--
      } else if (pv > sv) {
        pointerSteps.push({
          step: stepNum++,
          pIndex: i,
          sIndex: j,
          pVal: pv,
          sVal: sv,
          comparison: 'p_greater',
          action: `P[${i}] (${pv}) > S[${j}] (${sv}) → decrease i-- to catch up`,
          matchedSoFar: [...matches],
          bestId: matches.length > 0 ? matches[0] : -1,
        })
        i--
      } else {
        pointerSteps.push({
          step: stepNum++,
          pIndex: i,
          sIndex: j,
          pVal: pv,
          sVal: sv,
          comparison: 's_greater',
          action: `P[${i}] (${pv}) < S[${j}] (${sv}) → decrease j-- to catch up`,
          matchedSoFar: [...matches],
          bestId: matches.length > 0 ? matches[0] : -1,
        })
        j--
      }
    }

    pointerSteps.push({
      step: stepNum,
      pIndex: i,
      sIndex: j,
      pVal: i >= 0 ? pIds[i] : null,
      sVal: j >= 0 ? sIds[j] : null,
      comparison: 'done',
      action:
        matches.length > 0
          ? `Pointer exhausted (i=${i}, j=${j}). Largest common ID is #${matches[0]} (${matches.length} total).`
          : `Pointer exhausted (i=${i}, j=${j}). No common ID found → return -1.`,
      matchedSoFar: [...matches],
      bestId: matches.length > 0 ? matches[0] : -1,
    })

    return {
      prefix,
      suffix,
      reversedSuffix,
      prefixSteps,
      suffixSteps,
      prefixNode: pCur,
      suffixNode: sCur,
      pIds,
      sIds,
      pointerSteps,
      matches,
      bestId: matches.length > 0 ? matches[0] : -1,
    }
  }
}

/** Deterministic sorted children list of a TrieNode for clean SVG rendering. */
export function sortedChildren(node: TrieNode): TrieNode[] {
  return Array.from(node.children.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, child]) => child)
}

/**
 * Extract a readable visual subtree around an active query walk for large catalogs (3,000 books),
 * preserving the real TrieNode IDs and full sorted recordIds.
 */
export function buildDisplaySubtree(
  realRoot: TrieNode,
  walkSteps: WalkStep[],
  maxBranchSiblings = 2,
  maxNodes = 42,
): { root: TrieNode; realById: Map<number, TrieNode> } {
  const realById = new Map<number, TrieNode>()
  const walkedIds = new Set<number>([realRoot.id])
  let terminalNode: TrieNode = realRoot
  for (const s of walkSteps) {
    if (s.ok && s.toNode) {
      walkedIds.add(s.toNode.id)
      terminalNode = s.toNode
    }
  }

  const cloneNode = (src: TrieNode, parent: TrieNode | null): TrieNode => {
    const copy = new TrieNode(src.id, src.char, src.depth, parent, src.path)
    for (const rid of src.recordIds) copy.recordIds.push(rid)
    realById.set(src.id, src)
    return copy
  }

  const displayRoot = cloneNode(realRoot, null)
  let count = 1
  const queue: { real: TrieNode; disp: TrieNode }[] = [{ real: realRoot, disp: displayRoot }]

  let head = 0
  while (head < queue.length && count < maxNodes) {
    const { real, disp } = queue[head++]
    const children = sortedChildren(real)
    const isOnWalk = walkedIds.has(real.id)
    const isTerminal = real.id === terminalNode.id
    if (!isOnWalk && !isTerminal) continue

    // Always include walked child first, then up to maxBranchSiblings other children for context
    const picked: TrieNode[] = []
    for (const c of children) if (walkedIds.has(c.id)) picked.push(c)
    let extras = 0
    for (const c of children) {
      if (walkedIds.has(c.id)) continue
      if (extras >= (isTerminal ? maxBranchSiblings + 1 : maxBranchSiblings)) break
      picked.push(c)
      extras++
    }
    picked.sort((a, b) => (a.char < b.char ? -1 : a.char > b.char ? 1 : 0))

    for (const c of picked) {
      if (count >= maxNodes && !walkedIds.has(c.id)) continue
      const cDisp = cloneNode(c, disp)
      disp.children.set(c.char, cDisp)
      count++
      queue.push({ real: c, disp: cDisp })
    }
  }

  return { root: displayRoot, realById }
}
