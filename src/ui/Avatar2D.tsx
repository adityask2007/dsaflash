import { motion } from 'framer-motion'
import type { Mood } from '../lib/librarian'

const MOUTH: Record<Mood, string> = {
  happy: 'M 82 146 Q 100 162 118 146',
  excited: 'M 78 144 Q 100 168 122 144',
  thinking: 'M 86 150 Q 100 152 114 148',
  sorry: 'M 83 154 Q 100 142 117 154',
  curious: 'M 84 149 Q 100 158 116 147',
}
const BROW_L: Record<Mood, string> = {
  happy: 'M 66 98 Q 78 92 90 98',
  excited: 'M 66 94 Q 78 86 90 94',
  thinking: 'M 66 96 Q 78 91 90 99',
  sorry: 'M 66 101 Q 78 93 90 96',
  curious: 'M 66 95 Q 78 88 90 96',
}
const BROW_R: Record<Mood, string> = {
  happy: 'M 110 98 Q 122 92 134 98',
  excited: 'M 110 94 Q 122 86 134 94',
  thinking: 'M 110 99 Q 122 93 134 97',
  sorry: 'M 110 96 Q 122 93 134 101',
  curious: 'M 110 96 Q 122 98 134 100',
}

/** friendly 2D librarian for the mobile / 2D experience */
export function Avatar2D({ speaking, mood, size = 120 }: { speaking: boolean; mood: Mood; size?: number }) {
  return (
    <svg viewBox="0 0 200 220" width={size} height={size * 1.1} role="img" aria-label="Elara Quill, the librarian">
      <defs>
        <radialGradient id="av-bg" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#4a2f1b" />
          <stop offset="1" stopColor="#1e120a" />
        </radialGradient>
        <linearGradient id="av-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecbc98" />
          <stop offset="1" stopColor="#dca37e" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="220" rx="28" fill="url(#av-bg)" />
      {/* shelves */}
      {[40, 80, 120].map((y) => (
        <g key={y} opacity="0.5">
          <rect x="0" y={y + 22} width="200" height="4" fill="#6b4426" />
          {Array.from({ length: 14 }).map((_, i) => (
            <rect key={i} x={6 + i * 14} y={y + 2 + ((i * 7) % 6)} width="9" height={20 - ((i * 7) % 6)} fill={['#7b2d26', '#2f4a3a', '#274b5a', '#b08a47', '#5c2a3a'][i % 5]} />
          ))}
        </g>
      ))}
      <motion.g animate={{ y: [0, -1.5, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
        {/* hair back */}
        <path d="M 52 110 Q 48 52 100 46 Q 152 52 148 110 Q 150 150 138 168 L 62 168 Q 50 150 52 110 Z" fill="#3a2216" />
        {/* shoulders */}
        <path d="M 20 220 Q 24 176 70 168 L 130 168 Q 176 176 180 220 Z" fill="#5b1f2c" />
        <path d="M 84 168 L 100 196 L 116 168 Z" fill="#f1e9d6" />
        <path d="M 70 168 L 92 220 L 84 220 L 62 176 Z M 130 168 L 108 220 L 116 220 L 138 176 Z" fill="#74303e" />
        <rect x="97" y="182" width="6" height="36" fill="#c79a45" />
        {/* neck */}
        <rect x="88" y="150" width="24" height="24" rx="8" fill="#d6a07c" />
        {/* head */}
        <ellipse cx="100" cy="108" rx="43" ry="50" fill="url(#av-skin)" />
        <ellipse cx="58" cy="112" rx="6" ry="10" fill="#e0aa86" />
        <ellipse cx="142" cy="112" rx="6" ry="10" fill="#e0aa86" />
        {/* fringe */}
        <path d="M 56 100 Q 54 58 100 54 Q 146 58 144 100 Q 130 70 100 70 Q 70 70 56 100 Z" fill="#3a2216" />
        <circle cx="100" cy="44" r="14" fill="#3a2216" />
        {/* cheeks */}
        <ellipse cx="72" cy="132" rx="8" ry="5" fill="#e9958a" opacity="0.35" />
        <ellipse cx="128" cy="132" rx="8" ry="5" fill="#e9958a" opacity="0.35" />
        {/* brows */}
        <motion.path animate={{ d: BROW_L[mood] }} stroke="#2c1a10" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <motion.path animate={{ d: BROW_R[mood] }} stroke="#2c1a10" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        {/* eyes */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'blink2d 4.6s infinite' }}>
          <ellipse cx="78" cy="112" rx="8.5" ry="7" fill="#fbf8f2" />
          <circle cx="78" cy="112" r="4.6" fill="#4f7a52" />
          <circle cx="78" cy="112" r="2.2" fill="#0a0a0a" />
          <circle cx="76.5" cy="110.5" r="1.1" fill="#fff" />
        </g>
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'blink2d 4.6s infinite' }}>
          <ellipse cx="122" cy="112" rx="8.5" ry="7" fill="#fbf8f2" />
          <circle cx="122" cy="112" r="4.6" fill="#4f7a52" />
          <circle cx="122" cy="112" r="2.2" fill="#0a0a0a" />
          <circle cx="120.5" cy="110.5" r="1.1" fill="#fff" />
        </g>
        {/* glasses */}
        <circle cx="78" cy="112" r="14" fill="rgba(200,230,255,0.08)" stroke="#d4ac55" strokeWidth="2.2" />
        <circle cx="122" cy="112" r="14" fill="rgba(200,230,255,0.08)" stroke="#d4ac55" strokeWidth="2.2" />
        <path d="M 92 110 Q 100 106 108 110" stroke="#d4ac55" strokeWidth="2" fill="none" />
        {/* nose */}
        <path d="M 100 116 Q 96 130 101 132" stroke="#c98f6b" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* mouth */}
        <motion.ellipse cx="100" cy="150" rx="9" fill="#3a0d11" animate={speaking ? { ry: [1, 7, 2.5, 8, 1.5, 6, 1] } : { ry: 0.5 }} transition={speaking ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }} />
        <motion.path animate={{ d: MOUTH[mood] }} stroke="#b34e58" strokeWidth="4" strokeLinecap="round" fill="none" />
      </motion.g>
    </svg>
  )
}
