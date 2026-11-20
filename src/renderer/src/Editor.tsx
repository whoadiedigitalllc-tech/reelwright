import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Film, Image as ImageIcon, Music, Pipette, Plus, Sparkles, Type, Upload } from 'lucide-react'
import type { ChromaKey, Clip, MediaAsset, MediaClip, Project } from '../../shared/schema'
import { FONTS, assetOf, locate, mediaClip, place, projectDuration, setSpeed, textClip, timecode } from '../../shared/ops'
import { Player } from './Player'
import { Timeline } from './Timeline'
import { ASSET_MIME, api, errMsg, mediaUrl, useEditor } from './store'
import { Button, Field, NumberSlider } from './ui'

// ---------- autosave: debounced, flushed before the window closes ----------
let pending: Project | null = null
let timer: ReturnType<typeof setTimeout> | undefined
function flush() {
  clearTimeout(timer)
  const p = pending
  pending = null
  if (!p) return Promise.resolve()
  return api.saveProject(p).then(
    () => useEditor.setState({ saveState: pending ? 'saving' : 'saved' }),
    (e) => {
      useEditor.setState({ saveState: 'error' })
      useEditor.getState().toast(`Autosave failed: ${errMsg(e)}`, 'error')
    }
  )
}

function useAutosave() {
  useEffect(() => {
    const unsub = useEditor.subscribe((s, prev) => {
      if (!s.project || s.project === prev.project || s.project.id !== prev.project?.id) return
      pending = s.project
      useEditor.setState({ saveState: 'saving' })
      clearTimeout(timer)
      timer = setTimeout(flush, 800)
    })
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending) return
      e.preventDefault()
      e.returnValue = false // Electron: cancels the close silently; we close again once saved
      flush().then(() => window.close())
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      unsub()
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])
}

function useShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('dialog[open]')) return
      const s = useEditor.getState()
      const p = s.project
      if (!p) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (e.code === 'Space') s.togglePlay()
      else if (mod && key === 'z') e.shiftKey ? s.redo() : s.undo()
      else if (mod && key === 'y') s.redo()
      else if (!mod && key === 's') s.splitAtPlayhead()
      else if (key === 'delete' || key === 'backspace') s.removeSelected()
      else if (key === 'arrowleft' || key === 'arrowright') s.seek(s.time + (key === 'arrowleft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / p.fps))
      else if (key === 'home') s.seek(0)
      else if (key === 'end') s.seek(projectDuration(p))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
}

export function Editor() {
  useAutosave()
  useShortcuts()
  const [tab, setTab] = useState<'media' | 'text' | 'fades'>('media')
  const [exporting, setExporting] = useState(false)
  const tabs = [
    { id: 'media', label: 'Media', Icon: Film },
    { id: 'text', label: 'Text', Icon: Type },
    { id: 'fades', label: 'Fades', Icon: Sparkles }
  ] as const
  return (
    <main className="editor">
      <TopBar onExport={() => setExporting(true)} />
      <nav className="tabrail" role="tablist" aria-orientation="vertical">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} aria-controls="leftpanel" className="tab" onClick={() => setTab(id)}>
            <Icon size={18} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <section id="leftpanel" role="tabpanel" className="leftpanel">
        {tab === 'media' && <MediaPanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'fades' && <FadesPanel />}
      </section>
      <Player />
      <Inspector />
      <Timeline />
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </main>
  )
}

function TopBar({ onExport }: { onExport: () => void }) {
  const project = useEditor((s) => s.project)!
  const saveState = useEditor((s) => s.saveState)
  const { commit, close } = useEditor.getState()
  const back = async () => {
    await flush()
    close()
  }
  return (
    <header className="topbar">
      <Button variant="ghost" onClick={back} aria-label="Back to projects">
        <ArrowLeft size={16} aria-hidden /> Projects
      </Button>
      <h1 className="sr-only">Editing {project.name}</h1>
      <input
        className="title-input"
        aria-label="Project name"
        value={project.name}
        onChange={(e) => commit((d) => void (d.name = e.target.value), 'name')}
      />
      <span className={`save-state ${saveState}`} role="status">
        {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Not saved'}
      </span>
      <Button variant="primary" onClick={onExport} disabled={projectDuration(project) === 0}>
        <Download size={16} aria-hidden /> Export
      </Button>
    </header>
  )
}

// ---------- left panels ----------

function addAsset(a: MediaAsset) {
  const { commit, time } = useEditor.getState()
  commit((d) => (a.kind === 'audio' ? place(d, mediaClip(a), time) : place(d, mediaClip(a), Infinity, d.tracks[0].id)))
}

function MediaPanel() {
  const project = useEditor((s) => s.project)!
  const [busy, setBusy] = useState<string[]>([])
  const [over, setOver] = useState(false)
  const { commit, toast } = useEditor.getState()

  const importPaths = async (paths: string[]) => {
    for (const path of paths) {
      const name = path.split(/[\\/]/).pop()!
      setBusy((b) => [...b, name])
      try {
        const a = await api.probe(project.id, path)
        commit((d) => void d.assets.push(a))
      } catch (e) {
        toast(`Couldn't import ${name}: ${errMsg(e)}`, 'error')
      } finally {
        setBusy((b) => b.filter((x) => x !== name))
      }
    }
  }

  return (
    <div
      className={`panel media-panel${over ? ' drop-over' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        importPaths([...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean))
      }}
    >
      <Button variant="primary" className="wide" onClick={async () => importPaths(await api.pickMedia())}>
        <Upload size={16} aria-hidden /> Import
      </Button>
      {project.assets.length === 0 && busy.length === 0 && (
        <p className="empty-hint">Drop video, audio or images here, or click Import.</p>
      )}
      <ul className="tiles">
        {project.assets.map((a) => (
          <li key={a.id}>
            <button
              className={`tile${a.offline ? ' offline' : ''}`}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(ASSET_MIME, a.id)}
              onClick={() => addAsset(a)}
              title={`${a.path}\nClick to add, or drag to the timeline`}
            >
              <div className="tile-thumb">
                {a.thumb ? <img src={mediaUrl(a.thumb)} alt="" /> : a.kind === 'audio' ? <Music size={24} aria-hidden /> : <ImageIcon size={24} aria-hidden />}
                {a.kind !== 'image' && <span className="badge">{timecode(a.duration, 30).slice(0, 5)}</span>}
                {a.offline && <span className="badge badge-danger">Missing</span>}
                <span className="tile-add" aria-hidden><Plus size={14} /></span>
              </div>
              <span className="tile-name">{a.path.split(/[\\/]/).pop()}</span>
            </button>
          </li>
        ))}
        {busy.map((name) => (
          <li key={name} className="tile tile-busy" aria-busy="true">
            <div className="tile-thumb skeleton" />
            <span className="tile-name">Importing {name}…</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TEXT_PRESETS = [
  { name: 'Plain', style: {} },
  { name: 'Headline', style: { font: 'Impact', size: 140 } },
  { name: 'Caption', style: { size: 64, color: '#ffd84a' } },
  { name: 'Serif', style: { font: 'Georgia', size: 84 } },
  { name: 'Mono', style: { font: 'Consolas', size: 72, color: '#9be7ff' } }
]

function TextPanel() {
  const { commit, select } = useEditor.getState()
  const add = (style: Partial<Clip>) => {
    const c = textClip(useEditor.getState().time, style as never)
    commit((d) => place(d, c, c.start))
    select(c.id)
  }
  return (
    <div className="panel">
      <ul className="tiles">
        {TEXT_PRESETS.map((p) => (
          <li key={p.name}>
            <button className="tile text-tile" onClick={() => add(p.style)} title="Add at the playhead">
              <div className="tile-thumb">
                <span style={{ fontFamily: (p.style as { font?: string }).font ?? 'Arial', color: (p.style as { color?: string }).color ?? 'var(--c-text)' }}>Aa</span>
                <span className="tile-add" aria-hidden><Plus size={14} /></span>
              </div>
              <span className="tile-name">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FadesPanel() {
  const project = useEditor((s) => s.project)!
  const selected = useEditor((s) => s.selected)
  const commit = useEditor((s) => s.commit)
  const l = selected ? locate(project, selected) : undefined
  const apply = (kind: 'in' | 'out' | 'through') =>
    l &&
    commit((d) => {
      const { track, clip, index } = locate(d, l.clip.id)!
      const half = Math.min(0.5, clip.duration / 2)
      if (kind === 'in') clip.fadeIn = half
      if (kind === 'out') clip.fadeOut = half
      if (kind === 'through') {
        const prev = track.clips[index - 1]
        clip.fadeIn = Math.min(0.25, clip.duration / 2)
        if (prev && Math.abs(prev.start + prev.duration - clip.start) < 1e-3) prev.fadeOut = Math.min(0.25, prev.duration / 2)
      }
    })
  const items = [
    { id: 'in', name: 'Fade in' },
    { id: 'out', name: 'Fade out' },
    { id: 'through', name: 'Dip to black', hint: 'Fades the previous clip out and this one in' }
  ] as const
  return (
    <div className="panel">
      {!l && <p className="empty-hint">Select a clip on the timeline first.</p>}
      <ul className="tiles">
        {items.map((it) => (
          <li key={it.id}>
            <button className="tile" disabled={!l} onClick={() => apply(it.id)} title={'hint' in it ? it.hint : undefined}>
              <div className={`tile-thumb fade-${it.id}`} />
              <span className="tile-name">{it.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- inspector ----------

function Inspector() {
  const project = useEditor((s) => s.project)!
  const selected = useEditor((s) => s.selected)
  const commit = useEditor((s) => s.commit)
  const l = selected ? locate(project, selected) : undefined
  if (!l) {
    return (
      <aside className="inspector" aria-label="Clip properties">
        <p className="empty-hint">Select a clip to edit it.</p>
      </aside>
    )
  }
  const c = l.clip
  const a = assetOf(project, c)
  const upd = (key: string, fn: (c: Clip) => void) => commit((d) => fn(locate(d, c.id)!.clip), c.id + key)
  const visual = c.type === 'text' || a?.kind !== 'audio'
  const t = c.transform
  const half = +(c.duration / 2).toFixed(2)
  const title = c.type === 'text' ? 'Text' : a?.kind === 'audio' ? 'Audio' : a?.kind === 'image' ? 'Image' : 'Video'

  return (
    <aside className="inspector" aria-label="Clip properties">
      <h2>{title}</h2>
      {c.type === 'text' && (
        <fieldset>
          <legend>Text</legend>
          <Field label="Content">
            {(id) => <textarea id={id} rows={3} value={c.text} onChange={(e) => upd('text', (x) => void ((x as typeof c).text = e.target.value))} />}
          </Field>
          <Field label="Font">
            {(id) => (
              <select id={id} value={c.font} onChange={(e) => upd('font', (x) => void ((x as typeof c).font = e.target.value))}>
                {Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}
              </select>
            )}
          </Field>
          <NumberSlider label="Size" value={c.size} min={12} max={400} unit="px" onChange={(v) => upd('size', (x) => void ((x as typeof c).size = v))} />
          <Field label="Color">
            {(id) => <input id={id} type="color" value={c.color} onChange={(e) => upd('color', (x) => void ((x as typeof c).color = e.target.value))} />}
          </Field>
        </fieldset>
      )}
      {visual && (
        <fieldset>
          <legend>Position and size</legend>
          <NumberSlider label="X" value={t.x} min={-project.width} max={project.width} unit="px" onChange={(v) => upd('x', (x) => void (x.transform.x = v))} />
          <NumberSlider label="Y" value={t.y} min={-project.height} max={project.height} unit="px" onChange={(v) => upd('y', (x) => void (x.transform.y = v))} />
          <NumberSlider label="Scale" value={t.scale} min={10} max={400} scale={100} unit="%" onChange={(v) => upd('scale', (x) => void (x.transform.scale = v))} />
          {c.type !== 'text' && (
            <NumberSlider label="Rotation" value={t.rotation} min={-180} max={180} unit="°" onChange={(v) => upd('rot', (x) => void (x.transform.rotation = v))} />
          )}
          <NumberSlider label="Opacity" value={t.opacity} min={0} max={100} scale={100} unit="%" onChange={(v) => upd('op', (x) => void (x.transform.opacity = v))} />
        </fieldset>
      )}
      {c.type === 'media' && a?.kind !== 'image' && (
        <fieldset>
          <legend>Playback</legend>
          <NumberSlider label="Speed" value={c.speed} min={0.5} max={4} step={0.05} unit="×" onChange={(v) => commit((d) => setSpeed(d, c.id, v), c.id + 'speed')} />
          {a?.hasAudio && (
            <NumberSlider label="Volume" value={c.volume} min={0} max={200} scale={100} unit="%" onChange={(v) => upd('vol', (x) => void ((x as typeof c).volume = v))} />
          )}
        </fieldset>
      )}
      {c.type === 'media' && a?.kind !== 'audio' && <ChromaKeyFields clip={c} />}
      <fieldset>
        <legend>Fades</legend>
        <NumberSlider label="Fade in" value={c.fadeIn} min={0} max={half} step={0.05} unit="s" onChange={(v) => upd('fi', (x) => void (x.fadeIn = v))} />
        <NumberSlider label="Fade out" value={c.fadeOut} min={0} max={half} step={0.05} unit="s" onChange={(v) => upd('fo', (x) => void (x.fadeOut = v))} />
      </fieldset>
    </aside>
  )
}

function ChromaKeyFields({ clip: c }: { clip: MediaClip }) {
  const commit = useEditor((s) => s.commit)
  const toast = useEditor((s) => s.toast)
  const upd = (key: string, fn: (ck: ChromaKey, x: MediaClip) => void) =>
    commit((d) => {
      const x = locate(d, c.id)!.clip as MediaClip
      if (x.chromaKey) fn(x.chromaKey, x)
    }, c.id + key)
  const ck = c.chromaKey
  const pick = async () => {
    try {
      // Chromium's built-in eyedropper: click anywhere on screen, e.g. the green in the preview
      const r = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open()
      upd('ckc', (k) => void (k.color = r.sRGBHex))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(`Couldn't pick a colour: ${(e as Error).message}`, 'error')
    }
  }
  return (
    <fieldset>
      <legend>Chroma key</legend>
      <label className="check">
        <input
          type="checkbox"
          checked={!!ck}
          onChange={(e) =>
            commit((d) => {
              const x = locate(d, c.id)!.clip as MediaClip
              if (e.target.checked) x.chromaKey = { color: '#00ff00', similarity: 0.3, blend: 0.1 }
              else delete x.chromaKey
            })
          }
        />
        Remove a background colour
      </label>
      {ck && (
        <>
          <Field label="Key colour">
            {(id) => (
              <div className="inline">
                <input id={id} type="color" value={ck.color} onChange={(e) => upd('ckc', (k) => void (k.color = e.target.value))} />
                {'EyeDropper' in window && (
                  <Button onClick={pick}>
                    <Pipette size={14} aria-hidden /> Pick from screen
                  </Button>
                )}
              </div>
            )}
          </Field>
          <NumberSlider label="Strength" value={ck.similarity} min={1} max={100} scale={100} unit="%" onChange={(v) => upd('cks', (k) => void (k.similarity = v))} />
          <NumberSlider label="Softness" value={ck.blend} min={0} max={100} scale={100} unit="%" onChange={(v) => upd('ckb', (k) => void (k.blend = v))} />
        </>
      )}
    </fieldset>
  )
}

// ---------- export ----------

function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project)!
  const dlg = useRef<HTMLDialogElement>(null)
  const [short, setShort] = useState(1080)
  const [fps, setFps] = useState(project.fps)
  const [phase, setPhase] = useState<'settings' | 'running' | 'done' | 'error'>('settings')
  const [pct, setPct] = useState(0)
  const [result, setResult] = useState('')

  useEffect(() => {
    dlg.current?.showModal()
    return api.onExportProgress(setPct)
  }, [])

  const start = async () => {
    setPhase('running')
    setPct(0)
    try {
      await flush()
      const r = await api.exportVideo(project, { short, fps })
      if (r.canceled) return setPhase('settings')
      setResult(r.path!)
      setPhase('done')
    } catch (e) {
      setResult(errMsg(e))
      setPhase('error')
    }
  }

  return (
    <dialog ref={dlg} className="modal" onCancel={(e) => phase === 'running' && e.preventDefault()} onClose={onClose} aria-busy={phase === 'running'}>
      <h2>Export video</h2>
      {phase === 'settings' && (
        <>
          <Field label="Resolution">
            {(id) => (
              <select id={id} value={short} onChange={(e) => setShort(+e.target.value)}>
                <option value={720}>720p</option>
                <option value={1080}>1080p</option>
                <option value={1440}>1440p</option>
                <option value={2160}>4K</option>
              </select>
            )}
          </Field>
          <Field label="Frame rate">
            {(id) => (
              <select id={id} value={fps} onChange={(e) => setFps(+e.target.value)}>
                {[24, 25, 30, 50, 60].map((f) => <option key={f} value={f}>{f} fps</option>)}
              </select>
            )}
          </Field>
          <p className="muted">MP4 (H.264 + AAC), {timecode(projectDuration(project), project.fps)} long.</p>
          <div className="modal-actions">
            <Button onClick={() => dlg.current?.close()}>Cancel</Button>
            <Button variant="primary" onClick={start}>Choose file and export</Button>
          </div>
        </>
      )}
      {phase === 'running' && (
        <>
          <label className="field">
            Rendering… {Math.round(pct * 100)}%
            <progress max={1} value={pct} />
          </label>
          <div className="modal-actions">
            <Button onClick={() => api.cancelExport()}>Cancel export</Button>
          </div>
        </>
      )}
      {phase === 'done' && (
        <>
          <p>Saved to <code>{result}</code></p>
          <div className="modal-actions">
            {api.reveal && <Button onClick={() => api.reveal!(result)}>Show in folder</Button>}
            <Button variant="primary" onClick={() => dlg.current?.close()}>Done</Button>
          </div>
        </>
      )}
      {phase === 'error' && (
        <>
          <p className="error-text" role="alert">{result}</p>
          <div className="modal-actions">
            <Button onClick={() => dlg.current?.close()}>Close</Button>
            <Button variant="primary" onClick={() => setPhase('settings')}>Try again</Button>
          </div>
        </>
      )}
    </dialog>
  )
}
