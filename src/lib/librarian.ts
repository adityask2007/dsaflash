import { BOOKS, searchBooks, titleCase, type SearchOutcome } from './catalog'
import { parseMessage, type Awaiting } from './parser'

/* ============================================================================
 *  The librarian's dialog engine.
 *  ----------------------------------------------------------------------------
 *  respond()  : text in  -> lines to say + (optionally) a SEARCH REQUEST.
 *  describe() : takes the *real* SearchOutcome produced by the Trie and turns it
 *               into words. Book titles can only enter a reply through describe(),
 *               i.e. every recommendation originates from the search index.
 * ========================================================================== */

export type Mood = 'happy' | 'excited' | 'thinking' | 'sorry' | 'curious'
export type Gesture = 'wave' | 'present' | 'shrug' | 'think' | 'point'

export interface Utterance {
  text: string
  mood: Mood
  gesture?: Gesture
}

export interface DialogState {
  prefix: string | null
  suffix: string | null
  awaiting: Awaiting
  done: boolean
}

export const initialDialog: DialogState = { prefix: null, suffix: null, awaiting: 'both', done: false }

export type BrainAction =
  | { type: 'say'; lines: Utterance[]; state: DialogState }
  | { type: 'search'; lines: Utterance[]; prefix: string; suffix: string; state: DialogState }

export const WELCOME_LINE = 'Welcome to The Library! Looking for a book?'

export function greeting(): Utterance[] {
  return [
    { text: 'Hello! What book are you looking for?', mood: 'happy', gesture: 'wave' },
    { text: 'Tell me how the title begins and how it ends. For example: “it starts with cat and ends with og”.', mood: 'curious' },
  ]
}

const ASK_BOTH: Utterance = {
  text: 'To search I need both clues: how the title begins (the prefix) and how it ends (the suffix). Try: “starts with cat and ends with og”.',
  mood: 'curious',
}

export function respond(text: string, state: DialogState): BrainAction {
  const p = parseMessage(text, state.awaiting)
  const cleared: DialogState = { prefix: null, suffix: null, awaiting: 'both', done: false }
  const missing = (s: DialogState): Utterance =>
    s.prefix && !s.suffix
      ? { text: `So far I have the beginning: “${s.prefix}”. How does the title end?`, mood: 'curious' }
      : s.suffix && !s.prefix
        ? { text: `So far I have the ending: “${s.suffix}”. How does the title begin?`, mood: 'curious' }
        : ASK_BOTH

  switch (p.intent) {
    case 'reset':
      return { type: 'say', state: cleared, lines: [{ text: 'Of course, a fresh start! How does the title begin, and how does it end?', mood: 'happy' }] }
    case 'thanks':
      return { type: 'say', state, lines: [{ text: 'You are most welcome! Come back any time, there are 3,000 books waiting.', mood: 'excited' }] }
    case 'bye':
      return { type: 'say', state, lines: [{ text: 'Goodbye, and happy reading! The shelves will be here whenever you need them.', mood: 'happy', gesture: 'wave' }] }
    case 'who':
      return {
        type: 'say',
        state,
        lines: [{ text: 'I am Elara Quill, the head librarian. I know every one of our 3,000 titles by their beginnings and endings, which is very handy when you only half remember a name.', mood: 'happy' }],
      }
    case 'help':
      return {
        type: 'say',
        state,
        lines: [
          {
            text: 'Give me two clues: the first letters and the last letters of the title. I understand things like “starts with cat and ends with og”, “prefix sta suffix ar”, or a pattern such as “cat*og”.',
            mood: 'happy',
            gesture: 'point',
          },
        ],
      }
    case 'unsure':
      return { type: 'say', state, lines: [{ text: 'No worries, even a letter or two helps. Give me your best guess for the beginning and the ending of the title.', mood: 'curious' }, missing(state)] }
    case 'greeting':
      return { type: 'say', state, lines: [{ text: 'Hello again!', mood: 'happy', gesture: 'wave' }, missing(state)] }
    case 'unknown':
      return { type: 'say', state, lines: [{ text: 'Hmm, I could not find a clue in that.', mood: 'curious' }, missing(state)] }
    case 'clues': {
      if (p.invalid) {
        return {
          type: 'say',
          state,
          lines: [{ text: `Titles in our collection only use the letters a to z, so “${p.invalid}” cannot be part of a clue. Could you rephrase it with letters only?`, mood: 'curious' }],
        }
      }
      const base = state.done && !p.change && !p.fresh ? cleared : p.fresh ? cleared : state
      const prefix = p.prefix ?? base.prefix
      const suffix = p.suffix ?? base.suffix
      if (prefix && suffix) {
        return {
          type: 'search',
          prefix,
          suffix,
          state: { prefix, suffix, awaiting: null, done: true },
          lines: [{ text: 'Let me check our collection!', mood: 'thinking', gesture: 'think' }],
        }
      }
      const next: DialogState = { prefix, suffix, awaiting: prefix ? 'suffix' : 'prefix', done: false }
      if (prefix) return { type: 'say', state: next, lines: [{ text: `Got it, the title begins with “${prefix}”. And how does it end?`, mood: 'curious' }] }
      return { type: 'say', state: next, lines: [{ text: `Got it, the title ends with “${suffix}”. And how does it begin?`, mood: 'curious' }] }
    }
  }
}

export interface ResultCard {
  kind: 'found' | 'none'
  prefix: string
  suffix: string
  id: number
  title: string
  count: number
  /** other matching ids (descending), excluding `id` */
  others: number[]
  prefixCount: number
  suffixCount: number
  micros: number
  key: string
  edges: number
  overlap: boolean
}

/** Turn a REAL search outcome into the librarian's answer. */
export function describe(outcome: SearchOutcome, prefixOnly: SearchOutcome, suffixOnly: SearchOutcome): { lines: Utterance[]; card: ResultCard } {
  const { prefix, suffix } = outcome
  const base = {
    prefix,
    suffix,
    count: outcome.count,
    prefixCount: prefixOnly.count,
    suffixCount: suffixOnly.count,
    micros: outcome.micros,
    key: outcome.trace.key,
    edges: outcome.edges,
  }
  if (outcome.id >= 0) {
    const title = BOOKS[outcome.id].title
    const overlap = prefix.length + suffix.length > title.length
    const others: number[] = []
    for (let i = 1; i < outcome.matches.length; i++) others.push(outcome.matches[i])
    const card: ResultCard = { ...base, kind: 'found', id: outcome.id, title, others, overlap }
    const lines: Utterance[] = [
      { text: `I found it! The book is ${titleCase(title)}.`, mood: 'excited', gesture: 'present' },
      {
        text: `Its ID is ${outcome.id}. Why it matched: the title begins with “${prefix}” and ends with “${suffix}”${overlap ? ' (your two clues overlap inside the title)' : ''}. ${
          outcome.count > 1
            ? `${outcome.count} books fit both clues, so I brought you the one with the highest ID, the most recently catalogued.`
            : 'It is the only book that fits both clues.'
        } I have placed it on my desk.`,
        mood: 'happy',
      },
    ]
    return { lines, card }
  }
  const card: ResultCard = { ...base, kind: 'none', id: -1, title: '', others: [], overlap: false }
  const parts: string[] = []
  parts.push(
    prefixOnly.count > 0 ? `${prefixOnly.count} ${prefixOnly.count === 1 ? 'book begins' : 'books begin'} with “${prefix}”` : `no book begins with “${prefix}”`,
  )
  parts.push(
    suffixOnly.count > 0 ? `${suffixOnly.count} ${suffixOnly.count === 1 ? 'book ends' : 'books end'} with “${suffix}”` : `no book ends with “${suffix}”`,
  )
  const lines: Utterance[] = [
    { text: `I am sorry, no book in our collection both begins with “${prefix}” and ends with “${suffix}”.`, mood: 'sorry', gesture: 'shrug' },
    {
      text: `Here is what I can tell you: ${parts[0]}, and ${parts[1]}. ${
        prefixOnly.count > 0 && suffixOnly.count > 0 ? 'Each clue exists on its own, but never together in one title.' : 'Perhaps one of the clues is slightly different from what you remember?'
      } Give me new clues and I will look again.`,
      mood: 'curious',
    },
  ]
  return { lines, card }
}

/** convenience: run the Trie for a clue pair and compose the reply. */
export function runSearchAndDescribe(prefix: string, suffix: string) {
  const outcome = searchBooks(prefix, suffix)
  const prefixOnly = searchBooks(outcome.prefix, '', 1)
  const suffixOnly = searchBooks('', outcome.suffix, 1)
  return { outcome, ...describe(outcome, prefixOnly, suffixOnly) }
}
