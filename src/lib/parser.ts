/* ============================================================================
 *  Clue parser for the librarian – deterministic, rule based, no AI service.
 *  It only EXTRACTS a prefix and/or a suffix from free text. It never decides which
 *  book matches – that is always the job of the Trie (see librarian.ts).
 * ========================================================================== */

export type Awaiting = 'prefix' | 'suffix' | 'both' | null
export type Intent = 'clues' | 'reset' | 'help' | 'thanks' | 'bye' | 'greeting' | 'who' | 'unsure' | 'unknown'

export interface ParseResult {
  intent: Intent
  prefix: string | null
  suffix: string | null
  /** a clue that contained characters other than letters */
  invalid: string | null
  /** user explicitly wants to modify the previous search ("instead", "change"…) */
  change: boolean
  /** a "new search" style reset was mentioned together with clues */
  fresh: boolean
}

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean))

const START = set('start starts started starting begin begins began beginning prefix first opens opening')
const END = set('end ends ended ending finish finishes finished finishing suffix last closes closing')
// words that may sit between a keyword and the actual clue ("starts WITH THE LETTERS cat")
const STOP = set(
  `with in on as by is are was were the a an letters letter characters character chars char syllable it its that this of to at like be being maybe probably
   perhaps something i think believe remember recall guess thought say says said then also and but or title name book word one two three four five few couple
   from for about around kind sounds sound search searching looking look find me my im ive id lets please can could you would want need`,
)
// words ignored when we take "loose" answers to a direct question
const FILLER = set(
  `hello hi hey greetings howdy yes yeah yep ok okay sure please thanks thank well um uh hmm so and the a an it its i think maybe probably is are was it
   with letters letter characters char chars dont know idk not`,
)
const CHANGE = set('instead actually rather change changed correction correct oops sorry wait')
const GREETINGS = set('hi hello hey greetings howdy hola morning evening afternoon')
const THANKS = set('thanks thank thx cheers appreciated ty')
const BYES = set('bye goodbye farewell cya later')
const HELP = set('help how works instructions explain commands examples example options')

// words that are never a clue when they appear alone as an answer
const COMMANDS = new Set<string>([
  ...FILLER,
  ...GREETINGS,
  ...THANKS,
  ...BYES,
  ...HELP,
  ...set('reset restart clear cancel nevermind again idk forgot forget unsure who what librarian new'),
])

function tokenize(text: string): string[] {
  const out: string[] = []
  let cur = ''
  const s = text.toLowerCase()
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i)
    const c = s.charCodeAt(i)
    if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57)) cur += ch
    else if (ch === "'" || ch === '’' || ch === '`') continue // it's -> its,  'cat' -> cat
    else if (cur) {
      out.push(cur)
      cur = ''
    }
  }
  if (cur) out.push(cur)
  return out
}

function hasDigit(t: string): boolean {
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    if (c >= 48 && c <= 57) return true
  }
  return false
}

/** pattern clues such as  cat*og   cat...og   cat_og   *og   cat%  */
function parseWildcard(text: string): { prefix: string | null; suffix: string | null } | null {
  const s = text.toLowerCase().trim()
  const m = /([a-z]*)\s*(\.{2,}|…|\*+|%+|~+|_+)\s*([a-z]*)/.exec(s)
  if (!m) return null
  const a = m[1]
  const b = m[3]
  const dots = m[2].charAt(0) === '.' || m[2] === '…'
  if (!a && !b) return null
  if (dots && (!a || !b)) return null
  if (tokenize(s).length > 4) return null
  return { prefix: a || null, suffix: b || null }
}

export function parseMessage(text: string, awaiting: Awaiting): ParseResult {
  const tokens = tokenize(text)
  const res: ParseResult = { intent: 'unknown', prefix: null, suffix: null, invalid: null, change: false, fresh: false }

  // ---- 1. keyword driven extraction -------------------------------------
  let mode: 'start' | 'end' | null = null
  let sawKeyword = false
  const loose: string[] = []
  for (const t of tokens) {
    if (CHANGE.has(t)) res.change = true
    if (START.has(t)) {
      mode = 'start'
      sawKeyword = true
      continue
    }
    if (END.has(t)) {
      mode = 'end'
      sawKeyword = true
      continue
    }
    if (STOP.has(t)) continue
    if (mode) {
      if (hasDigit(t)) res.invalid = t
      else if (mode === 'start') {
        if (res.prefix === null) res.prefix = t
      } else if (res.suffix === null) res.suffix = t
      mode = null
    } else loose.push(t)
  }

  // ---- 2. wildcard patterns ----------------------------------------------
  if (res.prefix === null && res.suffix === null && !sawKeyword) {
    const w = parseWildcard(text)
    if (w) {
      res.prefix = w.prefix
      res.suffix = w.suffix
    }
  }

  // ---- 3. loose answers to a direct question -------------------------------
  if (res.prefix === null && res.suffix === null && res.invalid === null && awaiting && tokens.length <= 3) {
    const picked: string[] = []
    for (const t of loose) if (!COMMANDS.has(t)) picked.push(t)
    if (picked.length > 0) {
      for (const t of picked) if (hasDigit(t)) res.invalid = t
      if (res.invalid === null) {
        // the librarian always asks for the BEGINNING first, so a bare word answers that
        if (awaiting === 'suffix') res.suffix = picked[0]
        else {
          res.prefix = picked[0]
          if (picked.length > 1) res.suffix = picked[1]
        }
      }
    }
  }

  // ---- 4. intent -------------------------------------------------------------
  const has = (w: string) => tokens.indexOf(w) !== -1
  const resetWords = has('reset') || has('restart') || has('clear') || has('cancel') || has('nevermind') || has('again') || (has('start') && has('over')) || (has('new') && (has('search') || has('book') || has('one')))
  if (res.prefix !== null || res.suffix !== null || res.invalid !== null) {
    res.intent = 'clues'
    res.fresh = resetWords
    return res
  }
  if (resetWords) res.intent = 'reset'
  else if (has('idk') || (has('dont') && has('know')) || (has('not') && has('sure')) || (has('no') && has('idea')) || has('forgot') || has('forget') || has('unsure')) res.intent = 'unsure'
  else if (tokens.some((t) => THANKS.has(t))) res.intent = 'thanks'
  else if (tokens.some((t) => BYES.has(t))) res.intent = 'bye'
  else if (tokens.some((t) => HELP.has(t)) || has('what')) res.intent = 'help'
  else if (has('who') || has('name') || has('librarian')) res.intent = 'who'
  else if (tokens.some((t) => GREETINGS.has(t))) res.intent = 'greeting'
  return res
}
