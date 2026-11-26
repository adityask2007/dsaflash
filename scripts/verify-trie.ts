// npx tsx scripts/verify-trie.ts
// Cross-checks the Trie against the naive baseline on the real catalog.
import { readFileSync } from 'node:fs'
import { PrefixSuffixTrie } from '../src/lib/trie.ts'
import { bruteForceCount, bruteForceLargestId } from '../src/lib/bruteforce.ts'

const raw = JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8'))
const titles: string[] = raw.books.map((b: { title: string }) => b.title)
if (titles.length !== 3000) throw new Error('catalog must have 3000 books')

const trie = new PrefixSuffixTrie()
titles.forEach((t, i) => {
  if (trie.insert(t) !== i) throw new Error('id mismatch')
})
console.log('stats', trie.stats())

let seed = 12345
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}
let checked = 0
let nonEmpty = 0
const check = (p: string, s: string) => {
  const a = trie.largestId(p, s)
  const b = bruteForceLargestId(titles, p, s)
  const ca = trie.countMatches(p, s)
  const cb = bruteForceCount(titles, p, s)
  const list = trie.matches(p, s, 5000)
  if (a !== b || ca !== cb || list.length !== cb || (list.length && list[0] !== b)) {
    throw new Error(`MISMATCH for ${p}/${s}: trie ${a}/${ca} brute ${b}/${cb} list ${list.length}`)
  }
  for (let i = 1; i < list.length; i++) if (list[i] >= list[i - 1]) throw new Error('not descending')
  checked++
  if (cb > 0) nonEmpty++
}
// 1) every title's own prefix/suffix combinations (all lengths)
for (let r = 0; r < 4000; r++) {
  const t = titles[Math.floor(rnd() * titles.length)]
  const pl = Math.floor(rnd() * (t.length + 1))
  const sl = Math.floor(rnd() * (t.length + 1))
  check(t.slice(0, pl), t.slice(t.length - sl))
}
// 2) random letter pairs (mostly misses)
const L = 'abcdefghijklmnopqrstuvwxyz'
for (let r = 0; r < 4000; r++) {
  let p = ''
  let s = ''
  for (let i = 0, n = Math.floor(rnd() * 4); i < n; i++) p += L[Math.floor(rnd() * 26)]
  for (let i = 0, n = Math.floor(rnd() * 4); i < n; i++) s += L[Math.floor(rnd() * 26)]
  check(p, s)
}
// 3) the flagship example + edge cases
check('cat', 'og')
check('', '')
check('zzzzzzzzzzzz', '')
console.log('cat/og ->', trie.largestId('cat', 'og'), titles[trie.largestId('cat', 'og')], trie.matches('cat', 'og').map((i) => `${titles[i]}#${i}`).join(', '))
console.log(`OK – ${checked} queries verified (${nonEmpty} with matches, ${checked - nonEmpty} without).`)
