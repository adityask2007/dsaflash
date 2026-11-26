import { Settings, Trash2 } from 'lucide-react'
import type { Quality } from '../lib/storage'
import { useLibrary } from '../store'
import { PanelShell, btnGhost } from './common'

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-medium text-[#f6e7c3]">{title}</div>
        {hint && <div className="text-[12.5px] text-[#f1e4c8]/50">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-[#e3b866]/25">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={`px-3.5 py-1.5 text-sm font-medium transition ${value === o.v ? 'bg-[#e3b866] text-[#2a1a0c]' : 'text-[#f1e4c8]/75 hover:bg-white/10'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function SettingsPanel() {
  const close = useLibrary((s) => s.closePanel)
  const prefs = useLibrary((s) => s.prefs)
  const setPrefs = useLibrary((s) => s.setPrefs)
  const clearHistory = useLibrary((s) => s.clearHistory)
  const history = useLibrary((s) => s.history)
  return (
    <PanelShell title="Settings" subtitle="Saved in this browser (localStorage)" icon={<Settings size={20} />} onClose={close}>
      <div className="scroll-thin h-full space-y-3 overflow-y-auto px-5 pb-10 pt-4">
        <Row title="Experience" hint="3D is the full adventure. 2D is lighter and perfect for phones.">
          <Segmented value={prefs.mode} options={[{ v: '3d', l: 'Immersive 3D' }, { v: '2d', l: '2D' }]} onChange={(mode) => setPrefs({ mode })} />
        </Row>
        <Row title="Graphics quality" hint="Lower it if the 3D library feels slow. Affects shadows, resolution and dust.">
          <Segmented<Quality> value={prefs.quality} options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }]} onChange={(quality) => setPrefs({ quality })} />
        </Row>
        <Row title="Look sensitivity" hint={`Mouse drag and arrow-key turning speed (${prefs.sensitivity.toFixed(1)}×)`}>
          <input type="range" min={0.4} max={2.2} step={0.1} value={prefs.sensitivity} onChange={(e) => setPrefs({ sensitivity: Number(e.target.value) })} className="w-44 accent-[#e3b866]" aria-label="Look sensitivity" />
        </Row>
        <Row title="Control hints" hint="Show the keyboard cheat-sheet in the corner.">
          <Segmented value={prefs.showHints ? 'on' : 'off'} options={[{ v: 'on', l: 'Show' }, { v: 'off', l: 'Hide' }]} onChange={(v) => setPrefs({ showHints: v === 'on' })} />
        </Row>
        <Row title="Search history" hint={`${history.length} saved ${history.length === 1 ? 'search' : 'searches'}`}>
          <button onClick={clearHistory} className={btnGhost} disabled={history.length === 0}>
            <Trash2 size={15} /> Clear history
          </button>
        </Row>
        <p className="px-1 pt-2 text-xs text-[#f1e4c8]/40">Graphics changes apply immediately. Nothing is ever sent to a server.</p>
      </div>
    </PanelShell>
  )
}
