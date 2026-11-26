import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Crosshair, FastForward, RotateCcw, Send, Undo2, UserRound, X } from 'lucide-react'
import { showOnShelf } from '../actions'
import { useChat, type ChatMessage } from '../chatStore'
import { CHAR_MS, greetIfNeeded, restartConversation, skipSpeech, submitMessage } from '../converse'
import { BOOKS } from '../lib/catalog'
import type { ResultCard } from '../lib/librarian'
import { useLibrary } from '../store'
import { Avatar2D } from './Avatar2D'
import { BookCover, Chip, HighlightedTitle, PanelShell, btnGhost, btnGold, inputCls } from './common'

function TypedText({ text, at }: { text: string; at: number }) {
  const calc = () => Math.max(0, Math.min(text.length, Math.floor((performance.now() - at) / CHAR_MS)))
  const [n, setN] = useState(calc)
  useEffect(() => {
    if (calc() >= text.length) {
      setN(text.length)
      return
    }
    const t = setInterval(() => {
      const k = calc()
      setN(k)
      if (k >= text.length) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, text])
  return (
    <span className={n < text.length ? 'caret' : ''}>
      {text.slice(0, n)}
    </span>
  )
}

function ResultCardView({ card }: { card: ResultCard }) {
  const openDetail = useLibrary((s) => s.openDetail)
  const deskBookId = useLibrary((s) => s.deskBookId)
  const returnBook = useLibrary((s) => s.returnBook)
  const mode = useLibrary((s) => s.prefs.mode)
  if (card.kind === 'none') {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-red-400/30 bg-red-500/[0.07] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
          <X size={14} /> No match in the catalog
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="font-display text-2xl text-[#f0cf86]">{card.prefixCount}</div>
            <div className="text-[11px] text-[#f1e4c8]/55">start with “{card.prefix}”</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="font-display text-2xl text-[#8fe3d6]">{card.suffixCount}</div>
            <div className="text-[11px] text-[#f1e4c8]/55">end with “{card.suffix}”</div>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[#f1e4c8]/50">
          Trie key <span className="font-mono text-[#f1e4c8]/80">{card.key}</span> · {card.edges} edges · {card.micros.toFixed(0)} µs
        </p>
      </motion.div>
    )
  }
  const onDesk = deskBookId === card.id
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 20, stiffness: 240 }} className="rounded-2xl border border-[#e3b866]/40 bg-gradient-to-br from-[#e3b866]/14 to-transparent p-4">
      <div className="flex items-center gap-4">
        <BookCover id={card.id} size="md" animate />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e3b866]">Recommended book</div>
          <div className="truncate text-4xl font-semibold leading-tight">
            <HighlightedTitle title={card.title} prefix={card.prefix} suffix={card.suffix} />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip>Unique ID {card.id}</Chip>
            <Chip tone="plain">{card.count} {card.count === 1 ? 'match' : 'matches'}</Chip>
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-[13px] text-[#f1e4c8]/80">
        <li className="flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0 text-[#f0cf86]" />
          <span>
            Begins with “<b className="text-[#f0cf86]">{card.prefix}</b>”: <span className="font-mono">{card.title.slice(0, card.prefix.length)}</span>
            <span className="font-mono text-[#f1e4c8]/40">{card.title.slice(card.prefix.length)}</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check size={15} className="mt-0.5 shrink-0 text-[#8fe3d6]" />
          <span>
            Ends with “<b className="text-[#8fe3d6]">{card.suffix}</b>”: <span className="font-mono text-[#f1e4c8]/40">{card.title.slice(0, Math.max(0, card.title.length - card.suffix.length))}</span>
            <span className="font-mono">{card.title.slice(Math.max(0, card.title.length - card.suffix.length))}</span>
          </span>
        </li>
        {card.overlap && <li className="text-[12px] text-[#f1e4c8]/55">The two clues overlap inside this short title.</li>}
      </ul>

      {card.others.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f1e4c8]/50">Other books that also fit (lower IDs)</div>
          <div className="flex flex-wrap gap-1.5">
            {card.others.slice(0, 8).map((id) => (
              <button key={id} onClick={() => openDetail(id)} className="rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs text-[#f1e4c8]/85 hover:border-[#e3b866]/50">
                {BOOKS[id].title} <span className="font-mono text-[#e3b866]">#{id}</span>
              </button>
            ))}
            {card.others.length > 8 && <span className="px-1 py-1 text-xs text-[#f1e4c8]/45">+{card.count - 9} more</span>}
          </div>
        </div>
      )}

      <details className="group mt-3 text-[12px] text-[#f1e4c8]/60">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[#f1e4c8]/70 hover:text-white">
          <ChevronDown size={14} className="transition group-open:rotate-180" /> Under the hood
        </summary>
        <p className="mt-1.5 leading-relaxed">
          The librarian turned your clues into one Trie key, <span className="font-mono text-[#f6e7c3]">{card.key}</span> (suffix + “{'{'}” + prefix), walked <b>{card.edges}</b> edges in about <b>{card.micros.toFixed(0)} µs</b>, and read the largest ID stored at the end of the path.
        </p>
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => openDetail(card.id)} className={btnGold + ' !py-2'}>
          Book details
        </button>
        <button onClick={() => showOnShelf(card.id)} className={btnGhost}>
          <Crosshair size={15} /> {mode === '2d' ? 'Shelf (3D)' : 'Show on shelf'}
        </button>
        {onDesk && (
          <button onClick={returnBook} className={btnGhost}>
            <Undo2 size={15} /> Return to shelf
          </button>
        )}
      </div>
    </motion.div>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'card' && m.card) return <ResultCardView card={m.card} />
  if (m.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-b from-[#f0cf86] to-[#c6974a] px-4 py-2.5 text-[15px] font-medium text-[#2a1a0c]">
        {m.text}
      </motion.div>
    )
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-[92%] items-start gap-2.5">
      <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e3b866]/15 text-[#e3b866]">
        <UserRound size={15} />
      </span>
      <div className="rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[15px] leading-relaxed text-[#f6ead0]">
        <TypedText text={m.text} at={m.at} />
      </div>
    </motion.div>
  )
}

const SUGGESTIONS = ['I remember it starts with cat and ends with og', 'Starts with ec, ends with ho', 'It begins with zq and ends with x', 'How does this work?']

export function LibrarianPanel() {
  const close = useLibrary((s) => s.closePanel)
  const speaking = useLibrary((s) => s.librarian.speaking)
  const mood = useLibrary((s) => s.librarian.mood)
  const mode = useLibrary((s) => s.prefs.mode)
  const messages = useChat((s) => s.messages)
  const busy = useChat((s) => s.busy)
  const dialog = useChat((s) => s.dialog)
  const [text, setText] = useState('')
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void greetIfNeeded()
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const stick = () => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    stick()
    if (!busy) return
    const t = setInterval(() => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight
    }, 150)
    return () => clearInterval(t)
  }, [messages.length, busy])

  const send = (t: string) => {
    if (!t.trim() || busy) return
    setText('')
    void submitMessage(t)
  }

  const awaitingLabel = dialog.prefix && !dialog.suffix ? `Beginning: “${dialog.prefix}” · waiting for the ending` : dialog.suffix && !dialog.prefix ? `Ending: “${dialog.suffix}” · waiting for the beginning` : dialog.done && dialog.prefix && dialog.suffix ? `Clues used: “${dialog.prefix}” … “${dialog.suffix}”` : 'Waiting for two clues: beginning and ending'

  return (
    <PanelShell title="Elara Quill" subtitle="Head Librarian · understands “starts with … ends with …”" icon={<UserRound size={20} />} onClose={close}>
      <div className="flex h-full min-h-0 flex-col">
        {mode === '2d' && (
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
            <Avatar2D speaking={speaking} mood={mood} size={82} />
            <div className="text-sm text-[#f1e4c8]/65">
              <div className="font-display text-xl italic text-[#f6e7c3]">“Welcome to The Library! Looking for a book?”</div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-5 py-2 text-[12px] text-[#f1e4c8]/60">
          <span className="truncate">{awaitingLabel}</span>
          <button onClick={() => void restartConversation()} className="flex shrink-0 items-center gap-1 text-[#f1e4c8]/60 hover:text-[#f0cf86]" title="Start a new conversation">
            <RotateCcw size={12} /> restart
          </button>
        </div>

        <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {busy && messages.length > 0 && messages[messages.length - 1].role === 'user' && <div className="ml-9 text-xs text-[#f1e4c8]/45">Elara is thinking…</div>}
        </div>

        <div className="border-t border-white/10 bg-black/25 px-4 pb-4 pt-3">
          <div className="scroll-thin mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} disabled={busy} onClick={() => send(s)} className="shrink-0 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs text-[#f1e4c8]/80 transition hover:border-[#e3b866]/60 hover:bg-[#e3b866]/10 disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(text)
            }}
            className="flex items-center gap-2"
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={busy ? 'Elara is speaking…' : 'e.g. it starts with cat and ends with og'} className={inputCls} maxLength={240} aria-label="Message to the librarian" autoComplete="off" spellCheck={false} />
            {busy ? (
              <button type="button" onClick={skipSpeech} className={btnGhost + ' h-[46px] shrink-0'} title="Skip the speech">
                <FastForward size={16} /> Skip
              </button>
            ) : (
              <button type="submit" disabled={!text.trim()} className={btnGold + ' h-[46px] shrink-0'}>
                <Send size={16} /> Send
              </button>
            )}
          </form>
          <p className="mt-2 text-[11px] text-[#f1e4c8]/40">Every recommendation comes from the Trie index, never from the chat rules. Titles are shown capitalised, stored lowercase.</p>
        </div>
      </div>
    </PanelShell>
  )
}

