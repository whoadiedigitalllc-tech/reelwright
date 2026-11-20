// What the renderer needs from its platform. Desktop: src/preload (Electron IPC). Web: src/web/api.ts.
import type { MediaAsset, Project } from './schema'

export interface ProjectSummary { id: string; name: string; updatedAt: string; duration: number; thumb?: string }

export interface Voice { id: string; name: string }

export interface Api {
  listProjects(): Promise<ProjectSummary[]>
  createProject(p: Project): Promise<Project>
  loadProject(id: string): Promise<Project>
  saveProject(p: Project): Promise<void>
  renameProject(id: string, name: string): Promise<void>
  deleteProject(id: string): Promise<void>
  pickMedia(): Promise<string[]> // keys/paths to pass to probe()
  probe(projectId: string, path: string): Promise<MediaAsset>
  pathForFile(f: File): string
  saveRecording(projectId: string, wav: ArrayBuffer, name: string): Promise<string> // returns a key/path to pass to probe()
  exportVideo(p: Project, o: { short: number; fps: number }): Promise<{ path?: string; canceled?: boolean }>
  cancelExport(): Promise<void>
  onExportProgress(cb: (pct: number) => void): () => void
  reveal?(path: string): Promise<void> // desktop only
  mediaUrl?(path: string): string // web: storage key -> object URL; desktop uses media://
  storageNote?: string // shown on Home when where projects live isn't obvious (web)
  // ElevenLabs voice cloning + text to speech. Desktop only: the API key must stay out of browser code.
  voice?: {
    status(): Promise<{ hasKey: boolean }>
    setKey(key: string): Promise<{ tier: string; canClone: boolean }> // checks the key with ElevenLabs before storing it
    clearKey(): Promise<void>
    list(): Promise<Voice[]>
    clone(name: string, samplePaths: string[]): Promise<Voice & { requiresVerification: boolean }>
    speak(projectId: string, voiceId: string, text: string): Promise<string> // path of the saved MP3, to pass to probe()
  }
}
