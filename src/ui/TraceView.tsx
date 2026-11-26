import { motion } from 'framer-motion'
import type { QueryTrace } from '../lib/trie'

/** animated walk of the query key  suffix + "{" + prefix  through the Trie */
export function TraceView({ trace, speed = 0.11 }: { trace: QueryTrace; speed?: number }) {
  return (
    <div className="flex flex-wrap items-start gap-1.5" key={trace.key + (trace.complete ? '1' : '0')}>
      {trace.steps.map((s, i) => {
        const tone = !s.ok
          ? 'border-red-400/60 bg-red-500/15 text-red-300'
          : s.part === 'suffix'
            ? 'border-[#6fd3c4]/50 bg-[#6fd3c4]/10 text-[#8fe3d6]'
            : s.part === 'separator'
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-[#e3b866]/55 bg-[#e3b866]/12 text-[#f0cf86]'
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * speed, type: 'spring', damping: 16, stiffness: 260 }} className="flex flex-col items-center gap-1">
            <div className={`grid h-10 w-9 place-items-center rounded-lg border font-mono text-lg font-bold ${tone}`}>{s.isSeparator ? '{' : s.char}</div>
            <div className="h-4 text-[10px] leading-4 text-[#f1e4c8]/55">{s.ok && s.count !== null ? `×${s.count}` : s.ok ? '' : '✕'}</div>
          </motion.div>
        )
      })}
    </div>
  )
}

export function TraceLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#f1e4c8]/55">
      <span>
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#6fd3c4]" />
        suffix
      </span>
      <span>
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-white/70" />
        separator “{'{'}”
      </span>
      <span>
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#e3b866]" />
        prefix
      </span>
      <span>×N = books matching everything walked so far</span>
    </div>
  )
}
