// Web platform: projects and media in IndexedDB, ffmpeg in WebAssembly, export as a download.
// Implements the same Api as the Electron preload, so the renderer runs unchanged.
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import type { Api, ProjectSummary } from '../shared/api'
import type { MediaAsset, Project } from '../shared/schema'
import { projectDuration, uid } from '../shared/ops'
import { buildExportArgs } from '../main/exportArgs'
import { drawText } from '../renderer/src/drawText'
import { parseProbe } from './probe'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp'
}
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i
const extOf = (name: string) => (/\.[^./\\]+$/.exec(name)?.[0] ?? '').toLowerCase()
const baseName = (key: string) => key.split('/').pop()!

// ---------- IndexedDB: 'projects' (id -> Project), 'media' (<projectId>/<assetId>/<name> -> Blob) ----------

type Store = 'projects' | 'media'
let dbp: Promise<IDBDatabase> | null = null
const db = () =>
  (dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open('reelwright', 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('projects')
      r.result.createObjectStore('media')
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }))

async function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode)
    const r = fn(t.objectStore(store))
    t.oncomplete = () => resolve(r?.result as T)
    t.onerror = t.onabort = () => reject(t.error ?? new Error('Browser storage failed.'))
  })
}
const get = <T>(s: Store, k: string) => tx<T | undefined>(s, 'readonly', (st) => st.get(k))
const put = (s: Store, k: string, v: unknown) => tx<void>(s, 'readwrite', (st) => st.put(v, k))
const all = <T>(s: Store) => tx<T[]>(s, 'readonly', (st) => st.getAll())
const del = (s: Store, k: IDBValidKey | IDBKeyRange) => tx<void>(s, 'readwrite', (st) => st.delete(k))

// ---------- object URLs for preview ----------

const urls = new Map<string, string>()
function setUrl(key: string, blob: Blob) {
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(blob))
}
function dropUrls() {
  for (const u of urls.values()) URL.revokeObjectURL(u)
  urls.clear()
}

// Files chosen or dropped but not yet probed.
const pending = new Map<string, File>()
const register = (f: File) => {
  const key = `pending/${uid()}/${f.name}`
  pending.set(key, f)
  return key
}

// ---------- ffmpeg.wasm: one instance, one job at a time ----------

let ffp: Promise<FFmpeg> | null = null
function ffmpeg() {
  ffp ??= (async () => {
    const f = new FFmpeg()
    await f.load({ coreURL: await toBlobURL(coreURL, 'text/javascript'), wasmURL: await toBlobURL(wasmURL, 'application/wasm') })
    return f
  })()
  ffp.catch(() => (ffp = null))
  return ffp
}
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const r = queue.then(fn, fn)
  queue = r.catch(() => {})
  return r
}
let mounts = 0
async function withMount<T>(f: FFmpeg, blobs: { name: string; data: Blob }[], fn: (dir: string) => Promise<T>) {
  const dir = `/m${mounts++}`
  await f.createDir(dir)
  await f.mount('WORKERFS' as never, { blobs }, dir) // read in place, no copy into wasm memory
  try {
    return await fn(dir)
  } finally {
    await f.unmount(dir).catch(() => {})
    await f.deleteDir(dir).catch(() => {})
  }
}
async function run(f: FFmpeg, args: string[], onLine?: (line: string) => void) {
  const lines: string[] = []
  const h = ({ message }: { message: string }) => {
    lines.push(message)
    onLine?.(message)
  }
  f.on('log', h)
  try {
    const code = await f.exec(args)
    return { code, log: lines.join('\n') }
  } finally {
    f.off('log', h)
  }
}
const dataUrl = (bytes: Uint8Array, type: string) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(new Blob([bytes], { type }))
  })

let exportJob: { cancel: () => void } | null = null
const progressListeners = new Set<(pct: number) => void>()

export const webApi: Api = {
  async listProjects() {
    const ps = await all<Project>('projects')
    return ps
      .map((p): ProjectSummary => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, duration: projectDuration(p), thumb: p.assets.find((a) => a.thumb)?.thumb }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
  async createProject(p) {
    await put('projects', p.id, p)
    return p
  },
  async loadProject(id) {
    const p = await get<Project>('projects', id)
    if (!p) throw new Error('This project is no longer in this browser.')
    dropUrls()
    for (const a of p.assets) {
      const blob = await get<Blob>('media', a.path)
      a.offline = !blob
      if (blob) setUrl(a.path, blob)
    }
    return p
  },
  async saveProject(p) {
    await put('projects', p.id, { ...p, updatedAt: new Date().toISOString(), assets: p.assets.map(({ offline: _o, ...a }) => a) })
  },
  async renameProject(id, name) {
    const p = await get<Project>('projects', id)
    if (p) await put('projects', id, { ...p, name, updatedAt: new Date().toISOString() })
  },
  async deleteProject(id) {
    await del('projects', id)
    await del('media', IDBKeyRange.bound(`${id}/`, `${id}/￿`))
  },

  pickMedia: () =>
    new Promise((resolve) => {
      const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true, accept: Object.keys(MIME).join(',') })
      input.onchange = () => resolve([...(input.files ?? [])].map(register))
      input.oncancel = () => resolve([])
      input.click()
    }),
  pathForFile: register,

  probe: (projectId, key) =>
    exclusive(async () => {
      const file = pending.get(key)
      if (!file) throw new Error('the file is no longer available; import it again.')
      const ext = extOf(file.name)
      if (!MIME[ext]) throw new Error('this file type is not supported.')
      void navigator.storage?.persist?.() // ask the browser not to evict projects under disk pressure
      const f = await ffmpeg()
      const { info, thumb } = await withMount(f, [{ name: `in${ext}`, data: file }], async (dir) => {
        const info = parseProbe((await run(f, ['-hide_banner', '-i', `${dir}/in${ext}`])).log)
        let thumb: string | undefined
        if (info.video) {
          const seek = IMAGE.test(file.name) ? [] : ['-ss', String(Math.min(1, (info.duration || 0) / 3))]
          const { code } = await run(f, ['-hide_banner', ...seek, '-i', `${dir}/in${ext}`, '-frames:v', '1', '-vf', 'scale=320:-2', '-y', '/thumb.jpg'])
          if (code === 0) {
            thumb = await dataUrl((await f.readFile('/thumb.jpg')) as Uint8Array, 'image/jpeg')
            await f.deleteFile('/thumb.jpg')
          }
        }
        return { info, thumb }
      })
      if (!info.video && !info.audio) throw new Error('no video or audio in this file.')
      const kind: MediaAsset['kind'] = info.video && IMAGE.test(file.name) ? 'image' : info.video ? 'video' : 'audio'
      if (kind !== 'image' && !(info.duration > 0)) throw new Error('could not read the length of this file.')
      const id = uid()
      const path = `${projectId}/${id}/${file.name}`
      await put('media', path, file) // QuotaExceededError surfaces as the import error toast
      pending.delete(key)
      setUrl(path, file)
      return { id, path, kind, duration: kind === 'image' ? 0 : info.duration, width: info.width, height: info.height, hasAudio: kind !== 'image' && info.audio, thumb }
    }),

  exportVideo: (p, o) =>
    exclusive(async () => {
      let cancelled = false
      const f = await ffmpeg()
      exportJob = {
        cancel: () => {
          cancelled = true
          f.terminate()
          ffp = null // next use loads a fresh instance
        }
      }
      try {
        const used = p.assets.filter((a) => p.tracks.some((t) => t.clips.some((c) => c.type === 'media' && c.assetId === a.id)))
        const blobs: { name: string; data: Blob }[] = []
        for (const [i, a] of used.entries()) {
          const b = await get<Blob>('media', a.path)
          if (!b) throw new Error(`Media file is missing: ${baseName(a.path)}`)
          blobs.push({ name: `${i}${extOf(a.path)}`, data: b })
        }
        return await withMount(f, blobs, async (dir) => {
          const q: Project = { ...p, assets: p.assets.map((a) => {
            const i = used.indexOf(a)
            return i < 0 ? a : { ...a, path: `${dir}/${blobs[i].name}`, offline: false }
          }) }
          // Text: render each clip with the preview's own drawing code, overlay as an image.
          const textImages = new Map<string, string>()
          for (const t of p.tracks) {
            for (const c of t.clips) {
              if (c.type !== 'text' || t.hidden || !c.text.trim()) continue
              const cv = new OffscreenCanvas(p.width, p.height)
              drawText(cv.getContext('2d')!, c, p.width, p.height, 1)
              const png = `/text-${textImages.size}.png`
              await f.writeFile(png, new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer()))
              textImages.set(c.id, png)
            }
          }
          const { args, duration } = buildExportArgs(q, { out: '/out.mp4', short: o.short, fps: o.fps, tmpDir: '/', fontDir: '', textImages })
          const { code, log } = await run(f, args, (line) => {
            const m = /out_time_us=(\d+)/.exec(line)
            if (m) for (const cb of progressListeners) cb(Math.min(1, +m[1] / 1e6 / duration))
          })
          for (const png of textImages.values()) await f.deleteFile(png).catch(() => {})
          if (code !== 0) throw new Error(`Export failed: ${log.trim().split('\n').slice(-3).join(' ')}`)
          const data = (await f.readFile('/out.mp4')) as Uint8Array
          await f.deleteFile('/out.mp4')
          const name = `${p.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'video'}.mp4`
          const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([data], { type: 'video/mp4' })), download: name })
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
          return { path: `your Downloads folder as ${name}` }
        })
      } catch (e) {
        throw cancelled ? new Error('Export cancelled.') : e
      } finally {
        exportJob = null
      }
    }),
  cancelExport: async () => exportJob?.cancel(),
  onExportProgress(cb) {
    progressListeners.add(cb)
    return () => void progressListeners.delete(cb)
  },
  mediaUrl: (path) => (path.startsWith('data:') ? path : urls.get(path) ?? ''),
  storageNote:
    'Projects and media are saved in this browser on this computer. Nothing is uploaded. Clearing this site’s data deletes them, so keep your original files.'
}
