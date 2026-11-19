import { create } from 'zustand'
import { produce } from 'immer'
import type { Id, Project } from '../../shared/schema'
import { locate, projectDuration, remove, split } from '../../shared/ops'

export const api = window.api
export const mediaUrl = (path: string) => `media://local/${encodeURIComponent(path)}`
export const ASSET_MIME = 'application/x-asset-id'
// ipcRenderer.invoke wraps errors as "Error invoking remote method 'x': Error: <message>"
export const errMsg = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

type Toast = { id: number; kind: 'info' | 'error'; text: string }

interface EditorState {
  screen: 'home' | 'editor'
  project: Project | null
  past: Project[]
  future: Project[]
  lastKey: string
  lastAt: number
  selected: Id | null
  time: number
  playing: boolean
  pps: number // timeline pixels per second
  saveState: 'saved' | 'saving' | 'error'
  toasts: Toast[]
  open: (p: Project) => void
  close: () => void
  /** Undoable change. Same `key` within 600ms merges into one undo step (slider drags). */
  commit: (fn: (d: Project) => void, key?: string) => void
  begin: () => void
  live: (fn: (d: Project) => void) => void
  end: () => void
  undo: () => void
  redo: () => void
  select: (id: Id | null) => void
  seek: (t: number) => void
  togglePlay: () => void
  splitAtPlayhead: () => void
  removeSelected: () => void
  toast: (text: string, kind?: Toast['kind']) => void
  dismiss: (id: number) => void
}

let gestureBase: Project | null = null
let toastId = 0
const HISTORY = 100

export const useEditor = create<EditorState>((set, get) => ({
  screen: 'home',
  project: null,
  past: [],
  future: [],
  lastKey: '',
  lastAt: 0,
  selected: null,
  time: 0,
  playing: false,
  pps: 60,
  saveState: 'saved',
  toasts: [],

  open: (p) => set({ screen: 'editor', project: p, past: [], future: [], selected: null, time: 0, playing: false, saveState: 'saved' }),
  close: () => set({ screen: 'home', project: null, playing: false, selected: null }),

  commit: (fn, key) => {
    const { project, past, lastKey, lastAt } = get()
    if (!project) return
    const next = produce(project, fn)
    if (next === project) return
    const now = Date.now()
    const merge = !!key && key === lastKey && now - lastAt < 600
    set({ project: next, past: merge ? past : [...past.slice(-HISTORY + 1), project], future: [], lastKey: key ?? '', lastAt: now })
  },
  // Drag gestures: begin() remembers the start, live() updates without history, end() records one undo step.
  begin: () => {
    gestureBase = get().project
  },
  live: (fn) => {
    const p = get().project
    if (p) set({ project: produce(p, fn) })
  },
  end: () => {
    const { project, past } = get()
    if (gestureBase && project !== gestureBase) set({ past: [...past.slice(-HISTORY + 1), gestureBase], future: [], lastKey: '' })
    gestureBase = null
  },
  undo: () => {
    const { past, project, future } = get()
    if (!past.length || !project) return
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], lastKey: '' })
  },
  redo: () => {
    const { past, project, future } = get()
    if (!future.length || !project) return
    set({ project: future[0], future: future.slice(1), past: [...past, project], lastKey: '' })
  },

  select: (id) => set({ selected: id }),
  seek: (t) => {
    const p = get().project
    if (p) set({ time: Math.max(0, Math.min(t, projectDuration(p))) })
  },
  togglePlay: () => {
    const { playing, time, project } = get()
    if (!project) return
    const d = projectDuration(project)
    if (!d) return
    set({ playing: !playing, time: !playing && time >= d - 1e-3 ? 0 : time })
  },
  splitAtPlayhead: () => {
    const { project, selected, time, commit, select } = get()
    if (!project) return
    const sel = selected ? locate(project, selected)?.clip : undefined
    const target = sel && time > sel.start && time < sel.start + sel.duration
      ? sel
      : project.tracks[0].clips.find((c) => time > c.start && time < c.start + c.duration)
    if (!target) return
    let rightId: Id | undefined
    commit((d) => {
      rightId = split(d, target.id, time)
    })
    if (rightId) select(rightId)
  },
  removeSelected: () => {
    const { selected, commit } = get()
    if (!selected) return
    commit((d) => remove(d, selected))
    set({ selected: null })
  },

  toast: (text, kind = 'info') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    if (kind === 'info') setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
