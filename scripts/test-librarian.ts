// npx tsx scripts/test-librarian.ts  – exercises the parser + dialog engine
import { respond, initialDialog, runSearchAndDescribe, type DialogState } from '../src/lib/librarian.ts'

function run(msgs: string[]) {
  let st: DialogState = { ...initialDialog }
  console.log('--- conversation')
  for (const m of msgs) {
    const a = respond(m, st)
    st = a.state
    console.log('USER:', m)
    for (const l of a.lines) console.log('  LIB :', l.text)
    if (a.type === 'search') {
      const r = runSearchAndDescribe(a.prefix, a.suffix)
      console.log(`  [search ${a.prefix}/${a.suffix}] id=${r.outcome.id} count=${r.outcome.count} key=${r.outcome.trace.key}`)
      for (const l of r.lines) console.log('  LIB :', l.text)
    }
  }
}
run(['I remember that it starts with cat and ends with og.'])
run(['hello', 'it begins with sun', 'ight'])
run(['cat*og'])
run(['ends with ing, starts with th'])
run(['prefix: zq suffix: x'])
run(['I want something', 'starts with dog and ends with cat', 'new search: begins with ec, finishes with ho', 'ends with abc123'])
run(['the first three letters are pap and the last two letters are er'])
run(['cat', 'og'])
run(['cat og'])
run(["I don't know", 'thanks'])
