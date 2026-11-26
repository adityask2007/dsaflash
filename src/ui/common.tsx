import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { BOOKS, coverColor, coverInk, titleCase } from '../lib/catalog'
import { useLibrary } from '../store'

export const btnGold =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#f0cf86] to-[#b98a3e] px-4 py-2.5 text-sm font-semibold text-[#2a1a0c] shadow-[0_6px_20px_rgba(185,138,62,0.35)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[#e3b866]/30 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-[#f1e4c8] transition hover:bg-white/10 hover:border-[#e3b866]/60 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'
export const inputCls =
  'w-full rounded-xl border border-[#e3b866]/25 bg-black/30 px-3.5 py-2.5 text-[15px] text-[#f1e4c8] outline-none transition focus:border-[#e3b866]/70 focus:bg-black/40 focus:ring-2 focus:ring-[#e3b866]/15'

/** Slide-in drawer (3D mode) / centred sheet (2D mode) */
export function PanelShell({
  title,
  subtitle,
  icon,
  onClose,
  wide,
  full,
  headerAction,
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  wide?: boolean
  full?: boolean
  headerAction?: ReactNode
  children: ReactNode
}) {
  const mode = useLibrary((s) => s.prefs.mode)
  const is2d = mode === '2d'
  return (
    <motion.aside
      initial={{ opacity: 0, x: is2d ? 0 : 60, y: is2d ? 24 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: is2d ? 0 : 60, y: is2d ? 24 : 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 260 }}
      className={
        'glass fixed z-30 flex flex-col overflow-hidden ' +
        (full
          ? 'inset-0 sm:inset-4 sm:rounded-3xl'
          : is2d
            ? 'inset-0 sm:inset-6 sm:mx-auto sm:max-w-4xl sm:rounded-3xl'
            : 'inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-w-[100vw] sm:rounded-l-3xl sm:border-r-0 ' + (wide ? 'sm:w-[780px]' : 'sm:w-[540px]'))
      }
      aria-label={title}
    >
      <header className="flex items-start gap-3 border-b border-[#e3b866]/15 px-5 pb-3.5 pt-5">
        {icon && <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e3b866]/12 text-[#e3b866]">{icon}</div>}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-wide text-[#f6e7c3]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-[#f1e4c8]/60">{subtitle}</p>}
        </div>
        {headerAction}
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-[#f1e4c8]/70 transition hover:bg-white/10 hover:text-white" aria-label="Close panel">
          <X size={18} />
        </button>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.aside>
  )
}

/** CSS book cover */
export function BookCover({ id, size = 'md', animate = false }: { id: number; size?: 'xs' | 'sm' | 'md' | 'lg'; animate?: boolean }) {
  const dims = { xs: 'h-11 w-8 text-[7px]', sm: 'h-14 w-10 text-[8px]', md: 'h-24 w-[68px] text-[10px]', lg: 'h-44 w-32 text-sm' }[size]
  const { title } = bookOf(id)
  const color = coverColor(id)
  const inner = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[3px] rounded-l-[2px] shadow-[3px_4px_10px_rgba(0,0,0,0.5)] ${dims}`}
      style={{ background: `linear-gradient(100deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 12%, rgba(255,255,255,0.1) 14%, rgba(0,0,0,0) 40%), ${color}` }}
      aria-hidden
    >
      <div className="absolute inset-y-0 left-[10%] w-px bg-black/40" />
      <div className="absolute inset-x-[18%] top-[14%] h-px bg-[#e3b866]/70" />
      <div className="absolute inset-x-[18%] bottom-[14%] h-px bg-[#e3b866]/70" />
      <div className="flex h-full items-center justify-center px-[14%] pl-[22%] text-center font-display font-bold leading-tight tracking-wide break-all" style={{ color: coverInk(id) }}>{titleCase(title)}</div>
    </div>
  )
  if (!animate) return inner
  return (
    <motion.div initial={{ rotateY: -70, opacity: 0, y: 10 }} animate={{ rotateY: 0, opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 14, stiffness: 120 }} style={{ perspective: 600 }}>
      {inner}
    </motion.div>
  )
}

function bookOf(id: number) {
  return BOOKS[id]
}

/** shows which letters were matched by the prefix clue (gold) and the suffix clue (teal) */
export function HighlightedTitle({ title, prefix, suffix, className = '' }: { title: string; prefix: string; suffix: string; className?: string }) {
  const chars: ReactNode[] = []
  for (let i = 0; i < title.length; i++) {
    const inP = i < prefix.length
    const inS = i >= title.length - suffix.length
    const cls = inP && inS ? 'text-white underline decoration-2 decoration-[#e3b866] underline-offset-[6px]' : inP ? 'text-[#f0cf86]' : inS ? 'text-[#6fd3c4]' : 'text-[#f1e4c8]/55'
    chars.push(
      <span key={i} className={cls}>
        {title.charAt(i)}
      </span>,
    )
  }
  return <span className={'font-display tracking-[0.08em] ' + className}>{chars}</span>
}

export function Chip({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'teal' | 'red' | 'plain' }) {
  const t = {
    gold: 'border-[#e3b866]/30 bg-[#e3b866]/10 text-[#f0cf86]',
    teal: 'border-[#6fd3c4]/30 bg-[#6fd3c4]/10 text-[#8fe3d6]',
    red: 'border-red-400/30 bg-red-400/10 text-red-300',
    plain: 'border-white/10 bg-white/5 text-[#f1e4c8]/75',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${t}`}>{children}</span>
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e3b866]/70">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-semibold text-[#f6e7c3]">{value}</div>
      {hint && <div className="text-[11px] text-[#f1e4c8]/45">{hint}</div>}
    </div>
  )
}
