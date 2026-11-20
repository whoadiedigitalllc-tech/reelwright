import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api } from '../shared/api'

const api: Api = {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (p) => ipcRenderer.invoke('projects:create', p),
  loadProject: (id) => ipcRenderer.invoke('projects:load', id),
  saveProject: (p) => ipcRenderer.invoke('projects:save', p),
  renameProject: (id, name) => ipcRenderer.invoke('projects:rename', id, name),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  probe: (projectId, path) => ipcRenderer.invoke('media:probe', projectId, path),
  pathForFile: (f) => webUtils.getPathForFile(f),
  saveRecording: (projectId, wav, name) => ipcRenderer.invoke('media:saveRecording', projectId, wav, name),
  exportVideo: (p, o) => ipcRenderer.invoke('export:start', p, o),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  onExportProgress: (cb) => {
    const h = (_e: unknown, pct: number) => cb(pct)
    ipcRenderer.on('export:progress', h)
    return () => void ipcRenderer.removeListener('export:progress', h)
  },
  reveal: (path) => ipcRenderer.invoke('shell:reveal', path)
}

contextBridge.exposeInMainWorld('api', api)
