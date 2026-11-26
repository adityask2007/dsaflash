# THE LIBRARY – The Library's Half-Remembered Titles

An immersive 3D digital library whose search is powered by a **from-scratch prefix + suffix Trie**.
You remember how a title *starts* and how it *ends*; the index finds it in `O(|prefix| + |suffix|)`.

## Run it

```bash
npm install
npm run dev                      # Vite dev server
npm run build                    # static site -> dist/index.html (deployable anywhere)
npx tsx server/index.ts          # Express: serves dist/ + JSON API on :3000 (PORT=…)
npx tsx scripts/verify-trie.ts   # Trie vs. naive baseline on 8,000+ queries
npx tsx scripts/test-librarian.ts# conversation-engine demo
node scripts/generate-catalog.mjs# regenerate the (deterministic) catalog – output never changes
```

The browser app is fully self-contained (the Trie runs client-side). The Express server runs the *same*
`src/lib/trie.ts` and exposes `GET /api/health | /api/stats | /api/search?prefix=&suffix= | /api/books | /api/books/:id`.

## The algorithm (`src/lib/trie.ts`)

Every title `w` is inserted as `L+1` **wrapped keys**: `w[i..] + "{" + w` (e.g. `catdog` → `{catdog`, `g{catdog`, `og{catdog`, …).
A query (prefix `P`, suffix `S`) is the single key `S + "{" + P`, answered by **one walk** of the trie.
Every node after the separator keeps the ids that pass through it, newest first, so:

| operation | cost |
|---|---|
| query → largest matching id (or -1) | `O(|P| + |S|)` |
| exact number of matches | `O(|P| + |S|)` |
| list *k* matches (descending ids, no sorting) | `O(|P| + |S| + k)` |
| insert a title of length `L` | `O((L+1)²)` ≤ 81 steps |

Rules honoured by the core: no `Array.filter/find/findLast`, no `String.includes`, no regex, no libraries,
no per-query sorting, no scan of the catalog. IDs are assigned by the index itself in insertion order (0, 1, 2, …);
duplicate titles receive different ids. When several books match, the **largest id** wins.
`src/lib/bruteforce.ts` is a verification baseline used only by the Algorithm Explorer and the verify script.

## The data

`src/data/catalog.json` – exactly 3,000 lowercase titles (1–8 letters), ids 0–2999, generated once by a seeded script
(planted families for shared prefixes/suffixes such as `cat…`, `…og`, duplicates, and clue pairs with no match).
`cat` + `og` matches `catdog`, `catalog`, `catbog`, `catlog`, `catfog` → returns `catdog` (id 2728).

## The librarian

`src/lib/parser.ts` extracts prefix/suffix from free text with deterministic rules ("starts with … and ends with …",
"prefix: … suffix: …", `cat*og`, bare answers to her questions, corrections, resets, small talk).
`src/lib/librarian.ts` is the dialog state machine; it only ever returns a *search request*. `src/converse.ts`
runs the real Trie search, then composes the answer from the result, so every recommendation comes from the index.
The 3D librarian (`src/three/Librarian.tsx`) breathes, blinks, tracks the visitor, speaks and gestures.

## Controls (3D)

`W A S D` move · `↑ ↓` walk · `← →` turn · drag = look · scroll = zoom · `Shift` run · `E` interact · `Esc` close panels · click shelves, books and objects.
Phones and low-power devices start in the 2D interface (switchable in Settings / on the welcome screen).

## Structure

```
src/lib/        trie, brute-force baseline, catalog indexes, parser, librarian, layout, storage
src/three/      room, bookcases (instanced books), furniture, librarian, player controller, delivered book
src/ui/         welcome, HUD, panels (browse, search, librarian, algorithm, about, settings), 2D home
server/         Express API + static hosting
scripts/        catalog generator, trie verification, conversation test
```
