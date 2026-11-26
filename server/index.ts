/* ============================================================================
 *  Express backend for "The Library".
 *
 *    npm run build && npx tsx server/index.ts        (PORT=3000 by default)
 *
 *  - serves the built single-page app from dist/
 *  - exposes the SAME PrefixSuffixTrie class used in the browser as a JSON API
 *      GET /api/health
 *      GET /api/stats
 *      GET /api/search?prefix=cat&suffix=og&limit=20
 *      GET /api/books?offset=0&limit=50&letter=c&sort=id|title
 *      GET /api/books/:id
 *  The catalog is read from src/data/catalog.json and indexed in memory at start-up.
 * ========================================================================== */
import express from 'express'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrefixSuffixTrie } from '../src/lib/trie.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dist = path.join(root, 'dist')

interface Book {
  id: number
  title: string
}
const catalog = JSON.parse(readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8')) as { books: Book[] }
const books = catalog.books

const trie = new PrefixSuffixTrie()
for (const b of books) {
  const id = trie.insert(b.title)
  if (id !== b.id) throw new Error('catalog ids must be sequential from 0')
}

// one-time alphabetical order (title, then id) for the /api/books listing
const byTitle = books.map((b) => b.id)
byTitle.sort((a, b) => (books[a].title < books[b].title ? -1 : books[a].title > books[b].title ? 1 : a - b))

/** lowercase letters only, max 32 characters */
function clue(value: unknown): string {
  if (typeof value !== 'string') return ''
  let out = ''
  for (let i = 0; i < value.length && out.length < 32; i++) {
    const c = value.charCodeAt(i)
    if (c >= 97 && c <= 122) out += value.charAt(i)
    else if (c >= 65 && c <= 90) out += String.fromCharCode(c + 32)
  }
  return out
}
function int(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback
}

const app = express()
app.disable('x-powered-by')
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

app.get('/api/health', (_req, res) => {
  const s = trie.stats()
  res.json({ ok: true, books: s.books, nodes: s.nodes })
})

app.get('/api/stats', (_req, res) => res.json(trie.stats()))

app.get('/api/search', (req, res) => {
  const prefix = clue(req.query.prefix)
  const suffix = clue(req.query.suffix)
  const limit = int(req.query.limit, 20, 1, 200)
  const t0 = process.hrtime.bigint()
  const hit = trie.search(prefix, suffix)
  const ids = hit.count > 0 ? trie.matches(prefix, suffix, limit) : []
  const micros = Number(process.hrtime.bigint() - t0) / 1000
  res.json({
    prefix,
    suffix,
    id: hit.id,
    title: hit.id >= 0 ? books[hit.id].title : null,
    count: hit.count,
    edges: hit.edges,
    micros,
    matches: ids.map((id) => books[id]),
  })
})

app.get('/api/books', (req, res) => {
  const offset = int(req.query.offset, 0, 0, books.length)
  const limit = int(req.query.limit, 50, 1, 500)
  const letter = clue(req.query.letter).charAt(0)
  const sort = req.query.sort === 'title' ? 'title' : 'id'
  const order = sort === 'title' ? byTitle : books.map((b) => b.id)
  const out: Book[] = []
  let seen = 0
  for (let i = 0; i < order.length && out.length < limit; i++) {
    const b = books[order[i]]
    if (letter && b.title.charAt(0) !== letter) continue
    if (seen++ < offset) continue
    out.push(b)
  }
  res.json({ offset, limit, sort, letter: letter || null, total: books.length, books: out })
})

app.get('/api/books/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 0 || id >= books.length) {
    res.status(404).json({ error: 'no such book' })
    return
  }
  res.json(books[id])
})

app.use(express.static(dist))
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'not found' })
    return
  }
  res.sendFile(path.join(dist, 'index.html'))
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  const s = trie.stats()
  console.log(`The Library is open: http://localhost:${port}  (${s.books} books, ${s.nodes} trie nodes)`)
})
