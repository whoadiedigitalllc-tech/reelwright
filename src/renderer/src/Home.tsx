import { useEffect, useRef, useState } from 'react'
import { Film, MoreHorizontal, Plus } from 'lucide-react'
import { newProject, timecode } from '../../shared/ops'
import type { ProjectSummary } from '../../shared/api'
import { api, errMsg, mediaUrl, useEditor } from './store'
import { Button } from './ui'

const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

export function Home() {
  const [list, setList] = useState<ProjectSummary[] | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ProjectSummary | null>(null)
  const dlg = useRef<HTMLDialogElement>(null)
  const { open, toast } = useEditor.getState()

  const refresh = () => api.listProjects().then(setList, (e) => toast(errMsg(e), 'error'))
  useEffect(() => void refresh(), [])
  useEffect(() => {
    if (confirm) dlg.current?.showModal()
    else dlg.current?.close()
  }, [confirm])

  const create = async () => {
    try {
      open(await api.createProject(newProject(`Project ${new Date().toLocaleDateString()}`)))
    } catch (e) {
      toast(`Couldn't create the project: ${errMsg(e)}`, 'error')
    }
  }
  const openId = async (id: string) => {
    try {
      const p = await api.loadProject(id)
      open(p)
      const missing = p.assets.filter((a) => a.offline).length
      if (missing) toast(`${missing} media file(s) were moved or deleted and show as missing.`, 'error')
    } catch (e) {
      toast(`Couldn't open the project: ${errMsg(e)}`, 'error')
    }
  }
  const rename = async (id: string, name: string) => {
    setRenaming(null)
    if (!name.trim()) return
    await api.renameProject(id, name.trim()).catch((e) => toast(errMsg(e), 'error'))
    refresh()
  }
  const del = async () => {
    if (!confirm) return
    await api.deleteProject(confirm.id).catch((e) => toast(errMsg(e), 'error'))
    setConfirm(null)
    refresh()
  }

  return (
    <main className="home">
      <header className="home-head">
        <h1>Projects</h1>
        <Button variant="primary" onClick={create}>
          <Plus size={16} aria-hidden /> New project
        </Button>
      </header>

      {list && list.length === 0 && (
        <div className="empty-state">
          <Film size={40} aria-hidden />
          <p>No projects yet. Start one to begin editing.</p>
          <Button variant="primary" onClick={create}>
            <Plus size={16} aria-hidden /> New project
          </Button>
        </div>
      )}

      <ul className="project-grid">
        {list?.map((p) => (
          <li key={p.id} className="project-card">
            <button className="project-open" onClick={() => openId(p.id)} aria-label={`Open ${p.name}, ${timecode(p.duration, 30).slice(0, 5)}`}>
              <div className="project-thumb">
                {p.thumb ? <img src={mediaUrl(p.thumb)} alt="" /> : <Film size={28} aria-hidden />}
                <span className="badge">{timecode(p.duration, 30).slice(0, 5)}</span>
              </div>
            </button>
            <div className="project-meta">
              {renaming === p.id ? (
                <input
                  autoFocus
                  aria-label="Project name"
                  defaultValue={p.name}
                  onBlur={(e) => rename(p.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <span className="project-name" title={p.name}>{p.name}</span>
              )}
              <span className="muted">Edited {ago(p.updatedAt)}</span>
              <details className="menu">
                <summary aria-label={`Actions for ${p.name}`} className="btn btn-ghost btn-icon">
                  <MoreHorizontal size={16} aria-hidden />
                </summary>
                <div className="menu-list">
                  <Button variant="ghost" onClick={(e) => { e.currentTarget.closest('details')!.open = false; setRenaming(p.id) }}>Rename</Button>
                  <Button variant="ghost" onClick={(e) => { e.currentTarget.closest('details')!.open = false; setConfirm(p) }}>Delete</Button>
                </div>
              </details>
            </div>
          </li>
        ))}
      </ul>

      <dialog ref={dlg} className="modal" onClose={() => setConfirm(null)}>
        <h2>Delete project?</h2>
        <p>“{confirm?.name}” will be removed. Your original media files are not touched.</p>
        <div className="modal-actions">
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={del}>Delete</Button>
        </div>
      </dialog>
    </main>
  )
}
