import { interactableById, lookAtPose, poseForBook } from './lib/layout'
import { useLibrary } from './store'

export type NavOption = 'enter' | 'browse' | 'librarian' | 'search' | 'algorithm' | 'about'

/** welcome-screen navigation (3D: cinematic camera flight, 2D: straight to the panel) */
export function navigate(opt: NavOption) {
  const s = useLibrary.getState()
  if (s.prefs.mode === '2d') {
    useLibrary.setState({ view: 'library' })
    if (opt !== 'enter') s.activate(opt)
    return
  }
  if (opt === 'enter') {
    s.enterLibrary()
    return
  }
  const it = interactableById(opt)
  if (!it) {
    s.enterLibrary()
    return
  }
  s.enterLibrary(it.stand, opt === 'librarian' ? undefined : () => useLibrary.getState().activate(opt))
}

/** fly the camera to a book's shelf and light it up */
export function showOnShelf(id: number) {
  const s = useLibrary.getState()
  if (s.prefs.mode === '2d') s.setPrefs({ mode: '3d' })
  useLibrary.setState({ view: 'library', panel: null, detailId: null })
  s.highlight(id)
  s.flyTo(poseForBook(id), 2.4)
}

/** send a book on its way from the shelf to the librarian's desk */
export function bringToDesk(id: number, moveCamera = true) {
  const s = useLibrary.getState()
  s.deliverBook(id)
  if (moveCamera && s.prefs.mode === '3d' && s.view === 'library') {
    // wide shot of the desk, aimed a little to the right so the book stays visible beside the side panel
    s.flyTo(lookAtPose(0, -8.4, 1.35, 1.25, -11.2, 60), 1.8)
  }
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}
