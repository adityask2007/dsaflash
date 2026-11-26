import { ArrowRight, BookMarked, Cpu, Database, GitBranch, Info, Layers, Server, ShieldCheck, Sparkles } from 'lucide-react'
import { BOOK_COUNT, DUPLICATE_TITLE_COUNT, UNIQUE_TITLES } from '../lib/catalog'
import { useLibrary } from '../store'
import { PanelShell, btnGold } from './common'

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="mb-2 flex items-center gap-2.5 font-display text-xl font-semibold text-[#f6e7c3]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e3b866]/12 text-[#e3b866]">{icon}</span>
        {title}
      </h3>
      <div className="space-y-2 text-[14px] leading-relaxed text-[#f1e4c8]/75">{children}</div>
    </section>
  )
}

export function AboutPanel() {
  const close = useLibrary((s) => s.closePanel)
  const openPanel = useLibrary((s) => s.openPanel)
  return (
    <PanelShell title="About the Project" subtitle="The Library’s Half-Remembered Titles · DSA & Architecture" icon={<Info size={20} />} onClose={close}>
      <div className="scroll-thin h-full space-y-4 overflow-y-auto px-5 pb-10 pt-4">
        <p className="font-display text-xl italic leading-snug text-[#f6e7c3]">You remember how a title begins and how it ends, but not what is in the middle. The Library finds it.</p>

        <Block icon={<Layers size={16} />} title="The problem">
          <p>
            Given a <b className="text-[#f0cf86]">prefix</b> and a <b className="text-[#8fe3d6]">suffix</b>, return the insertion ID of a book whose title starts with the prefix and ends with the suffix, or <b>-1</b> when none exists. When several books fit, the
            <b> largest ID</b> wins.
          </p>
          <p className="rounded-lg border border-[#e3b866]/20 bg-[#e3b866]/[0.06] p-2.5 text-[13px]">
            Example: <span className="font-mono">cat</span> + <span className="font-mono">og</span> fits <i>catdog</i>, <i>catalog</i>, <i>catlog</i>, … and the index returns the newest one in a single walk of 6 edges.
          </p>
        </Block>

        <Block icon={<GitBranch size={16} />} title="Where DSA is used in this project">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Dual Trie + Two-Pointer Visual Model (<code>src/lib/dualTrie.ts</code>):</b> Uses <code>TrieNode</code> objects for a left-to-right <b>Prefix Trie</b> and a right-to-left <b>Reversed Suffix Trie</b>, each storing sorted <code>recordIds</code> arrays merged via a <b>two-pointer intersection</b> starting from the largest indices.
            </li>
            <li>
              <b>Suffix-Wrapped Trie (<code>src/lib/trie.ts</code>):</b> Optimizes search to strict <b>O(|P| + |S|)</b> by inserting <code>L+1</code> wrapped keys (<code>w[i..] + '{'{'}' + w</code>) into one Trie backed by <b>5 flat <code>Int32Array</code>s</b> (<code>children</code>, <code>counts</code>, <code>heads</code>, <code>entryId</code>, <code>entryNext</code>).
            </li>
            <li>
              <b>Head-Inserted Intrusive Linked Lists:</b> Every post-separator node pushes new IDs to the head of its singly linked list, keeping IDs in strictly descending order with <b>O(1)</b> max-ID lookup and zero sorting.
            </li>
            <li>
              <b>Hash Map, Buckets &amp; Pre-Sorted Arrays (<code>src/lib/catalog.ts</code>):</b> A <code>Map&lt;string, number[]&gt;</code> groups duplicate titles in O(1), 26 letter buckets group A–Z, and one-time <code>orderByTitle</code> / <code>rankByTitle</code> <code>Int32Array</code>s index shelf positions.
            </li>
            <li>
              <b>Spatial &amp; UI Algorithms:</b> 2-pass circle-vs-AABB collision resolution in 3D (<code>src/three/Player.tsx</code>), windowed virtual scrolling for 3,000 rows (<code>src/ui/BrowsePanel.tsx</code>), and a deterministic rule-based parser &amp; state machine (<code>src/lib/parser.ts</code>, <code>src/lib/librarian.ts</code>).
            </li>
          </ul>
          <button onClick={() => openPanel('algorithm')} className={btnGold + ' mt-2 !py-2 text-xs'}>
            <Cpu size={14} /> Open 2D Interactive Algorithm Explorer <ArrowRight size={14} />
          </button>
        </Block>

        <Block icon={<Sparkles size={16} />} title="The experience">
          <ul className="list-disc space-y-1 pl-5">
            <li>An explorable 3D library: {BOOK_COUNT.toLocaleString()} books on twelve carved bookcases (three instanced meshes), reading tables, chandeliers, sun shafts and floating dust.</li>
            <li>Elara Quill, a procedural 3D librarian who breathes, blinks, tracks you with her eyes, gestures while she talks, and fetches the book you ask for.</li>
            <li>A deterministic conversation engine (rules + templates, no AI service) that extracts a prefix and a suffix from free text and always asks the Trie.</li>
            <li>Interactive 2D Trie Visualizer with side-by-side Prefix (L→R) &amp; Reversed Suffix (R←L) SVGs, zoom/pan, clickable <code>TrieNode</code> <code>recordIds</code>, playback controls, live two-pointer step table, and Presenter View.</li>
            <li>Browse, filter, sort and inspect every book, including duplicates, with a virtualized list, plus a 2D interface for phones and low-power devices.</li>
          </ul>
        </Block>

        <Block icon={<Database size={16} />} title="The data">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Exactly <b>{BOOK_COUNT.toLocaleString()}</b> lowercase titles of 1–8 letters, IDs 0–{BOOK_COUNT - 1} in insertion order.
            </li>
            <li>
              {UNIQUE_TITLES.toLocaleString()} unique titles and {DUPLICATE_TITLE_COUNT} titles that appear more than once (each copy keeps its own ID).
            </li>
            <li>Generated once by a seeded script (<code>scripts/generate-catalog.mjs</code>) and committed as JSON, so it never changes between runs.</li>
            <li>Planted families give shared prefixes (cat…), shared suffixes (…og), shared prefix and suffix combinations and clue pairs with no match.</li>
          </ul>
        </Block>

        <Block icon={<ShieldCheck size={16} />} title="Rules the core search obeys">
          <p>The index is a from-scratch class (<code>src/lib/trie.ts</code>) built on flat typed arrays. Its query path has no Array.filter / find / findLast, no String.includes, no regular expressions, no search libraries, no per-query sorting and no scan of the catalog.</p>
          <p>A naive loop exists only in the Algorithm Explorer and in the verification script, to prove the Trie returns identical answers (8,000+ random queries, zero disagreements).</p>
        </Block>

        <Block icon={<Server size={16} />} title="Stack & running it">
          <p>React 19, Vite, TypeScript, Tailwind CSS 4, Three.js, React Three Fiber, Drei, Framer Motion, Lucide, Zustand, plus Node + Express for the optional API. Preferences and search history live in localStorage.</p>
          <pre className="scroll-thin overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[12px] text-[#d9ccb0]">{`npm install
npm run dev                   # development
npm run build                 # static site in dist/
npx tsx server/index.ts       # Express: serves dist/ + /api
npx tsx scripts/verify-trie.ts`}</pre>
        </Block>

        <Block icon={<BookMarked size={16} />} title="Credits">
          <p>All geometry, textures and the librarian are generated in code. No external images, fonts or APIs are loaded.</p>
        </Block>
      </div>
    </PanelShell>
  )
}
