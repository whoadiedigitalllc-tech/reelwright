import { Editor } from './Editor'
import { Home } from './Home'
import { useEditor } from './store'
import { Toasts } from './ui'

export function App() {
  const screen = useEditor((s) => s.screen)
  return (
    <>
      {screen === 'home' ? <Home /> : <Editor />}
      <Toasts />
    </>
  )
}
