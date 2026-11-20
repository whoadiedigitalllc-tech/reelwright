import { useSyncExternalStore } from 'react'
import { MonitorSmartphone } from 'lucide-react'
import { Editor } from './Editor'
import { Home } from './Home'
import { useEditor } from './store'
import { Toasts } from './ui'

// The editor needs room for four panes. Desktop windows can't get this narrow; browser tabs and phones can.
const NARROW = '(max-width: 999px)'
const narrowQuery = () => window.matchMedia(NARROW)
const subscribe = (cb: () => void) => {
  const q = narrowQuery()
  q.addEventListener('change', cb)
  return () => q.removeEventListener('change', cb)
}

export function App() {
  const screen = useEditor((s) => s.screen)
  const narrow = useSyncExternalStore(subscribe, () => narrowQuery().matches)
  if (narrow) {
    return (
      <main className="narrow">
        <MonitorSmartphone size={40} aria-hidden />
        <div role="alert">
          <h1>Reelwright needs a wider window</h1>
          <p className="muted">Make this window at least 1000px wide, or open Reelwright on a computer.</p>
        </div>
      </main>
    )
  }
  return (
    <>
      {screen === 'home' ? <Home /> : <Editor />}
      <Toasts />
    </>
  )
}
