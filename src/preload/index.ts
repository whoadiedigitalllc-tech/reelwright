import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { MediaAsset, Project } from '../shared/schema'

export interface ProjectSummary { id: string; name: string; updatedAt: string; duration: number; thumb?: string }

const api = {
  listProjects: (): Promise<ProjectSummary[]> => ipcRenderer.invoke('projects:list'),
  createProject: (p: Project): Promise<Project> => ipcRenderer.invoke('projects:create', p),
  loadProject: (id: string): Promise<Project> => ipcRenderer.invoke('projects:load', id),
  saveProject: (p: Project): Promise<void> => ipcRenderer.invoke('projects:save', p),
  renameProject: (id: string, name: string): Promise<void> => ipcRenderer.invoke('projects:rename', id, name),
  deleteProject: (id: string): Promise<void> => ipcRenderer.invoke('projects:delete', id),
  pickMedia: (): Promise<string[]> => ipcRenderer.invoke('media:pick'),
  probe: (projectId: string, path: string): Promise<MediaAsset> => ipcRenderer.invoke('media:probe', projectId, path),
  pathForFile: (f: File) => webUtils.getPathForFile(f),
  exportVideo: (p: Project, o: { short: number; fps: number }): Promise<{ path?: string; canceled?: boolean }> =>
    ipcRenderer.invoke('export:start', p, o),
  cancelExport: (): Promise<void> => ipcRenderer.invoke('export:cancel'),
  onExportProgress: (cb: (pct: number) => void) => {
    const h = (_e: unknown, pct: number) => cb(pct)
    ipcRenderer.on('export:progress', h)
    return () => void ipcRenderer.removeListener('export:progress', h)
  },
  reveal: (path: string): Promise<void> => ipcRenderer.invoke('shell:reveal', path)
}

contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
