import { Component, Suspense, lazy, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useLibrary } from './store'
import { AboutPanel } from './ui/AboutPanel'
import { AlgorithmPanel } from './ui/AlgorithmPanel'
import { BookDetail } from './ui/BookDetail'
import { BrowsePanel } from './ui/BrowsePanel'
import { HUD } from './ui/HUD'
import { Home2D } from './ui/Home2D'
import { LibrarianPanel } from './ui/LibrarianPanel'
import { SearchPanel } from './ui/SearchPanel'
import { SettingsPanel } from './ui/SettingsPanel'
import { Welcome } from './ui/Welcome'

const Scene = lazy(() => import('./three/Scene'))

/** if WebGL fails for any reason, fall back to the 2D interface instead of a blank page */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.error('3D scene failed, switching to 2D', err)
    useLibrary.getState().setPrefs({ mode: '2d' })
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Loading() {
  return (
    <div className="absolute inset-0 z-0 grid place-items-center bg-[#120b06]">
      <div className="flex items-center gap-3 font-display text-xl tracking-[0.2em] text-[#e3b866]">
        <Loader2 className="animate-spin" size={22} /> OPENING THE LIBRARY…
      </div>
    </div>
  )
}

function Panels() {
  const panel = useLibrary((s) => s.panel)
  return (
    <AnimatePresence mode="wait">
      {panel === 'browse' && <BrowsePanel key="browse" />}
      {panel === 'search' && <SearchPanel key="search" />}
      {panel === 'librarian' && <LibrarianPanel key="librarian" />}
      {panel === 'algorithm' && <AlgorithmPanel key="algorithm" />}
      {panel === 'about' && <AboutPanel key="about" />}
      {panel === 'settings' && <SettingsPanel key="settings" />}
    </AnimatePresence>
  )
}

export default function App() {
  const view = useLibrary((s) => s.view)
  const mode = useLibrary((s) => s.prefs.mode)
  const detailId = useLibrary((s) => s.detailId)

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#120b06] text-[#f1e4c8]">
      {mode === '3d' && (
        <SceneBoundary>
          <Suspense fallback={<Loading />}>
            <Scene />
          </Suspense>
        </SceneBoundary>
      )}
      {mode === '2d' && view === 'welcome' && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#3a2415_0%,#1a0f08_60%,#100905_100%)]" />}

      {view === 'welcome' ? <Welcome /> : mode === '3d' ? <HUD /> : <Home2D />}

      <Panels />
      <AnimatePresence>{detailId !== null && <BookDetail key={detailId} id={detailId} />}</AnimatePresence>
    </div>
  )
}
