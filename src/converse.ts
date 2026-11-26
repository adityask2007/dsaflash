import { bringToDesk, sleep } from './actions'
import { useChat } from './chatStore'
import { greeting, respond, runSearchAndDescribe, type Utterance } from './lib/librarian'
import { useLibrary } from './store'

/* ============================================================================
 *  Conversation driver (independent of React): parses the visitor's words, runs
 *  the REAL Trie search when both clues are known, and performs the librarian's
 *  speech / mood / gesture / book-delivery choreography.
 * ========================================================================== */

export const CHAR_MS = 15
let skipping = false

async function wait(ms: number) {
  const end = performance.now() + ms
  while (performance.now() < end && !skipping) await sleep(40)
}

async function say(lines: Utterance[], onLine?: (i: number) => void) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    skipping = false
    useChat.getState().push({ role: 'librarian', text: l.text, mood: l.mood })
    const lib = useLibrary.getState()
    lib.setMood(l.mood)
    if (l.gesture) lib.gesture(l.gesture)
    lib.setSpeaking(true)
    onLine?.(i)
    await wait(l.text.length * CHAR_MS + 350)
    useLibrary.getState().setSpeaking(false)
    await wait(180)
  }
  skipping = false
}

export function skipSpeech() {
  skipping = true
  useChat.getState().revealAll()
}

export async function greetIfNeeded() {
  const chat = useChat.getState()
  if (chat.started) return
  chat.setStarted(true)
  chat.setBusy(true)
  await say(greeting())
  useChat.getState().setBusy(false)
}

export async function restartConversation() {
  skipping = true
  await sleep(60)
  useChat.getState().reset()
  useLibrary.getState().setSpeaking(false)
  await greetIfNeeded()
}

export async function submitMessage(raw: string) {
  const text = raw.trim().slice(0, 240)
  const chat = useChat.getState()
  if (!text || chat.busy) return
  chat.push({ role: 'user', text })
  chat.setBusy(true)
  const action = respond(text, chat.dialog)
  chat.setDialog(action.state)
  useLibrary.getState().setMood('thinking')
  await wait(420)
  await say(action.lines)

  if (action.type === 'search') {
    const lib = useLibrary.getState()
    // tidy the desk: the previous book goes back to its shelf first
    if (lib.deskBookId !== null) {
      lib.returnBook()
      if (lib.prefs.mode === '3d' && lib.view === 'library') await wait(2800)
      else useLibrary.getState().clearDeskBook()
    }
    // >>> the one and only source of recommendations: the Trie index <<<
    const r = runSearchAndDescribe(action.prefix, action.suffix)
    useLibrary.getState().addHistory({ prefix: r.outcome.prefix, suffix: r.outcome.suffix, id: r.outcome.id, count: r.outcome.count, source: 'librarian' })
    await say(r.lines, (i) => {
      if (i === 0 && r.outcome.id >= 0) bringToDesk(r.outcome.id)
    })
    useChat.getState().push({ role: 'card', text: '', card: r.card })
  }
  useChat.getState().setBusy(false)
}
