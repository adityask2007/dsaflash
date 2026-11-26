/* ============================================================================
 *  VERIFICATION BASELINE – never used to answer a user's search.
 *  ----------------------------------------------------------------------------
 *  A deliberately naive scan of the catalog (hand-written loops, no filter/find).
 *  It exists only so the Algorithm Explorer can (a) prove the Trie's answers are
 *  correct and (b) show how much faster the Trie is.
 * ========================================================================== */

export function startsWithAt(title: string, clue: string, offset: number): boolean {
  if (offset < 0 || offset + clue.length > title.length) return false
  for (let i = 0; i < clue.length; i++) if (title.charCodeAt(offset + i) !== clue.charCodeAt(i)) return false
  return true
}

/** Largest id whose title starts with `prefix` and ends with `suffix` (O(N·L)). */
export function bruteForceLargestId(titles: readonly string[], prefix: string, suffix: string): number {
  for (let i = titles.length - 1; i >= 0; i--) {
    const t = titles[i]
    if (startsWithAt(t, prefix, 0) && startsWithAt(t, suffix, t.length - suffix.length)) return i
  }
  return -1
}

export function bruteForceCount(titles: readonly string[], prefix: string, suffix: string): number {
  let n = 0
  for (let i = 0; i < titles.length; i++) {
    const t = titles[i]
    if (startsWithAt(t, prefix, 0) && startsWithAt(t, suffix, t.length - suffix.length)) n++
  }
  return n
}
