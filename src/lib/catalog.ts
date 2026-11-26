import raw from '../data/catalog.json'
import { PrefixSuffixTrie, type QueryTrace } from './trie'

/* ----------------------------------------------------------------------------
 * The catalog + every index built once at start-up (3,000 books, ids 0..2999).
 * ------------------------------------------------------------------------- */

export interface Book {
  id: number
  title: string
}

export const BOOKS: readonly Book[] = raw.books as Book[]
export const TITLES: readonly string[] = BOOKS.map((b) => b.title)
export const BOOK_COUNT = BOOKS.length

/** The prefix/suffix Trie – the heart of the project. */
export const trie = new PrefixSuffixTrie()
for (let i = 0; i < BOOKS.length; i++) {
  const id = trie.insert(BOOKS[i].title)
  if (id !== BOOKS[i].id) throw new Error('catalog ids must be sequential from 0')
}

/** exact-title groups (O(1) lookup of "complete name" + duplicates) */
const groups = new Map<string, number[]>()
for (let i = 0; i < BOOKS.length; i++) {
  const t = BOOKS[i].title
  const g = groups.get(t)
  if (g) g.push(i)
  else groups.set(t, [i])
}
export const UNIQUE_TITLES = groups.size

export function idsForTitle(title: string): readonly number[] {
  return groups.get(title) ?? []
}
/** every copy of this book's title (including itself), ascending ids */
export function copiesOf(id: number): readonly number[] {
  return groups.get(BOOKS[id].title) ?? [id]
}

/** ids grouped by first letter, ascending id order (bucket pass, no sorting) */
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
export const letterBuckets: number[][] = LETTERS.map(() => [])
for (let i = 0; i < BOOKS.length; i++) letterBuckets[BOOKS[i].title.charCodeAt(0) - 97].push(i)

/** ids whose title appears more than once */
export const duplicateIds: number[] = []
for (let i = 0; i < BOOKS.length; i++) if ((groups.get(BOOKS[i].title) as number[]).length > 1) duplicateIds.push(i)
export const DUPLICATE_TITLE_COUNT = (() => {
  let n = 0
  groups.forEach((g) => {
    if (g.length > 1) n++
  })
  return n
})()

/** one-time (title, id) ordering used to shelve books alphabetically */
export const orderByTitle: Int32Array = (() => {
  const idx = Array.from({ length: BOOKS.length }, (_, i) => i)
  idx.sort((a, b) => {
    const ta = BOOKS[a].title
    const tb = BOOKS[b].title
    if (ta < tb) return -1
    if (ta > tb) return 1
    return a - b
  })
  return Int32Array.from(idx)
})()
export const rankByTitle: Int32Array = (() => {
  const r = new Int32Array(BOOKS.length)
  for (let i = 0; i < orderByTitle.length; i++) r[orderByTitle[i]] = i
  return r
})()

/* ----------------------------------------------------------------------------
 * Search facade – every recommendation goes through the Trie.
 * ------------------------------------------------------------------------- */

export interface SearchOutcome {
  prefix: string
  suffix: string
  /** largest matching id or -1 */
  id: number
  count: number
  /** up to `limit` matching ids, descending (the first one is `id`) */
  matches: number[]
  edges: number
  micros: number
  trace: QueryTrace
}

/** lowercases and keeps a-z only */
export function normalizeClue(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    if (c >= 97 && c <= 122) out += input.charAt(i)
    else if (c >= 65 && c <= 90) out += String.fromCharCode(c + 32)
  }
  return out
}

export function searchBooks(prefixInput: string, suffixInput: string, limit = 60): SearchOutcome {
  const prefix = normalizeClue(prefixInput)
  const suffix = normalizeClue(suffixInput)
  const t0 = performance.now()
  const hit = trie.search(prefix, suffix)
  const matches = hit.count > 0 ? trie.matches(prefix, suffix, limit) : []
  const micros = (performance.now() - t0) * 1000
  return { prefix, suffix, id: hit.id, count: hit.count, matches, edges: hit.edges, micros, trace: trie.trace(prefix, suffix) }
}

/* ----------------------------------------------------------------------------
 * Presentation helpers
 * ------------------------------------------------------------------------- */

export const titleCase = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1)

export function hashId(id: number, salt = 0): number {
  let h = (Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39) >>> 0
  h ^= h >>> 15
  return h >>> 0
}

export const COVER_PALETTE = [
  '#7b2d26', '#8c3b2a', '#a4452c', '#5c2a3a', '#6a2c5a', '#2f4a3a', '#3d5a40', '#274b5a', '#1f3b57',
  '#33405e', '#4a3a28', '#5b4630', '#7a5a34', '#b08a47', '#c2a15d', '#d7c49a', '#3a2a22', '#263a34',
  '#6b3f2a', '#8a6a4a', '#44302a', '#2c2f4a', '#74402e', '#97603a',
]
export function coverColor(id: number): string {
  return COVER_PALETTE[hashId(id, 3) % COVER_PALETTE.length]
}

/** readable ink colour for a cover: dark brown on light covers, gold on dark covers */
export function coverInk(id: number): string {
  const n = parseInt(coverColor(id).slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.55 ? '#2a1a0c' : '#f2dca4'
}
