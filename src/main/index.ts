import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, shell } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import type { MediaAsset, Project } from '../shared/schema'
import { projectDuration, uid } from '../shared/ops'
import { buildExportArgs } from './exportArgs'
import * as eleven from './elevenlabs'

const run = promisify(execFile)
// Binaries can't run from inside app.asar; electron-builder unpacks them (see asarUnpack in package.json).
const unpacked = (p: string) => p.replace('app.asar', 'app.asar.unpacked')
const FFMPEG = unpacked(ffmpegStatic as unknown as string)
const FFPROBE = unpacked(ffprobeStatic.path)

if (process.env.VE_USER_DATA) app.setPath('userData', process.env.VE_USER_DATA) // e2e tests use a throwaway folder

const ID = /^[0-9a-f-]{36}$/
const root = () => join(app.getPath('userData'), 'projects')
const dir = (id: string) => {
  if (!ID.test(id)) throw new Error('Bad project id')
  return join(root(), id)
}
const exists = (p: string) => fs.access(p).then(() => true, () => false)

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp'
}
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i

// ---------- media:// protocol: streams local media to the renderer with range support (needed for seeking) ----------

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } }
])

async function serveMedia(req: Request): Promise<Response> {
  const path = decodeURIComponent(new URL(req.url).pathname.slice(1))
  const type = MIME[extname(path).toLowerCase()]
  if (!type) return new Response('Not a media file', { status: 403 })
  let size: number
  try {
    size = (await fs.stat(path)).size
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') ?? '')
  const start = m?.[1] ? Number(m[1]) : 0
  const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1
  if (start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
  const body = Readable.toWeb(createReadStream(path, { start, end })) as unknown as ReadableStream
  // CORS so the preview canvas stays readable (not tainted) when it draws these frames.
  const headers: Record<string, string> = {
    'content-type': type, 'content-length': String(end - start + 1), 'accept-ranges': 'bytes', 'access-control-allow-origin': '*'
  }
  if (m) headers['content-range'] = `bytes ${start}-${end}/${size}`
  return new Response(body, { status: m ? 206 : 200, headers })
}

// ---------- projects on disk ----------

async function writeProject(p: Project) {
  const d = dir(p.id)
  await fs.mkdir(d, { recursive: true })
  const file = join(d, 'project.json')
  const doc: Project = { ...p, updatedAt: new Date().toISOString(), assets: p.assets.map(({ offline: _o, ...a }) => a) }
  await fs.copyFile(file, file + '.bak').catch(() => {})
  // Write then rename, so a crash mid-write never leaves a half-written project.json.
  await fs.writeFile(file + '.tmp', JSON.stringify(doc))
  await fs.rename(file + '.tmp', file)
}

let saveQueue: Promise<unknown> = Promise.resolve()
const save = (p: Project) => (saveQueue = saveQueue.then(() => writeProject(p), () => writeProject(p)))

async function readProject(id: string): Promise<Project> {
  const file = join(dir(id), 'project.json')
  let p: Project
  try {
    p = JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    p = JSON.parse(await fs.readFile(file + '.bak', 'utf8')) // last good save
  }
  if (p.version !== 1) throw new Error(`This project was made with a newer version (format ${p.version}).`)
  return p
}

async function probe(projectId: string, path: string): Promise<MediaAsset> {
  // ffprobe "reads" almost anything (a .txt is a video via its tty demuxer); only accept what preview can serve.
  if (!MIME[extname(path).toLowerCase()]) throw new Error('this file type is not supported.')
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path]).catch(() => {
    throw new Error('not a video, audio or image file this app can read.')
  })
  const j = JSON.parse(stdout)
  const streams: any[] = j.streams ?? []
  const v = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic)
  const hasAudio = streams.some((s) => s.codec_type === 'audio')
  if (!v && !hasAudio) throw new Error('no video or audio in this file.')
  const kind: MediaAsset['kind'] = v && IMAGE.test(path) ? 'image' : v ? 'video' : 'audio'
  const duration = kind === 'image' ? 0 : parseFloat(j.format?.duration ?? v?.duration ?? '')
  if (kind !== 'image' && !(duration > 0)) throw new Error('could not read the length of this file.')
  const id = uid()
  let thumb: string | undefined
  if (v) {
    const out = join(dir(projectId), 'thumbs', `${id}.jpg`)
    await fs.mkdir(dirname(out), { recursive: true })
    const seek = kind === 'video' ? ['-ss', String(Math.min(1, duration / 3))] : []
    await run(FFMPEG, [...seek, '-i', path, '-frames:v', '1', '-vf', 'scale=320:-2', '-y', out]).then(
      () => (thumb = out),
      () => {} // no thumbnail is not fatal
    )
  }
  return { id, path, kind, duration, width: v?.width, height: v?.height, hasAudio: kind !== 'image' && hasAudio, thumb }
}

// ---------- IPC ----------

let job: ChildProcess | null = null

function registerIpc() {
  ipcMain.handle('projects:list', async () => {
    await fs.mkdir(root(), { recursive: true })
    const out = []
    for (const id of (await fs.readdir(root())).filter((x) => ID.test(x))) {
      try {
        const p = await readProject(id)
        out.push({ id, name: p.name, updatedAt: p.updatedAt, duration: projectDuration(p), thumb: p.assets.find((a) => a.thumb)?.thumb })
      } catch {
        // unreadable project folder: skip it rather than break the home screen
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
  ipcMain.handle('projects:create', async (_e, p: Project) => {
    await save(p)
    return p
  })
  ipcMain.handle('projects:load', async (_e, id: string) => {
    const p = await readProject(id)
    for (const a of p.assets) a.offline = !(await exists(a.path))
    return p
  })
  ipcMain.handle('projects:save', (_e, p: Project) => save(p))
  ipcMain.handle('projects:rename', async (_e, id: string, name: string) => {
    const p = await readProject(id)
    await save({ ...p, name })
  })
  ipcMain.handle('projects:delete', (_e, id: string) => fs.rm(dir(id), { recursive: true, force: true }))

  ipcMain.handle('media:pick', async (e) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender)!, {
      title: 'Import media',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video, audio and images', extensions: Object.keys(MIME).map((x) => x.slice(1)) },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('media:probe', (_e, projectId: string, path: string) => probe(projectId, path))
  // Mic recordings live in the project folder, so deleting the project deletes them too.
  ipcMain.handle('media:saveRecording', async (_e, projectId: string, wav: ArrayBuffer, name: string) => {
    const safe = basename(String(name)).replace(/[\\/:*?"<>|]/g, '_')
    if (extname(safe).toLowerCase() !== '.wav') throw new Error('Recordings must be WAV.')
    const out = join(dir(projectId), 'recordings', safe)
    await fs.mkdir(dirname(out), { recursive: true })
    await fs.writeFile(out, Buffer.from(wav), { flag: 'wx' }) // never overwrite an earlier take
    return out
  })

  ipcMain.handle('export:start', async (e, p: Project, o: { short: number; fps: number }) => {
    if (job) throw new Error('An export is already running.')
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender)!, {
      title: 'Export video',
      defaultPath: join(app.getPath('videos'), `${p.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'video'}.mp4`),
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }]
    })
    if (r.canceled || !r.filePath) return { canceled: true }
    const out = r.filePath
    const tmp = await fs.mkdtemp(join(tmpdir(), 'export-'))
    try {
      const fontDir = join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts')
      const { args, duration, textFiles } = buildExportArgs(p, { out, short: o.short, fps: o.fps, tmpDir: tmp, fontDir })
      for (const f of textFiles) await fs.writeFile(f.path, f.text)
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(FFMPEG, args, { windowsHide: true })
        job = proc
        let err = ''
        proc.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
        proc.stdout.on('data', (d) => {
          const all = [...String(d).matchAll(/out_time_us=(\d+)/g)]
          if (all.length) e.sender.send('export:progress', Math.min(1, Number(all[all.length - 1][1]) / 1e6 / duration))
        })
        proc.on('error', reject)
        proc.on('close', (code) =>
          code === 0
            ? resolve()
            : reject(new Error(proc.killed ? 'Export cancelled.' : `ffmpeg failed: ${err.trim().split('\n').slice(-3).join(' ')}`))
        )
      })
    } catch (err) {
      await fs.rm(out, { force: true }) // no half-written video left behind
      throw err
    } finally {
      job = null
      await fs.rm(tmp, { recursive: true, force: true })
    }
    return { path: out }
  })
  ipcMain.handle('export:cancel', () => {
    job?.kill()
  })
  ipcMain.handle('shell:reveal', (_e, p: string) => shell.showItemInFolder(p))

  // ---------- ElevenLabs: key encrypted with the OS (DPAPI on Windows), never sent to the renderer ----------
  const keyFile = () => join(app.getPath('userData'), 'elevenlabs.key')
  const readKey = () => fs.readFile(keyFile()).then((b) => safeStorage.decryptString(b), () => null)
  const needKey = async () => (await readKey()) ?? Promise.reject(new Error('Add your ElevenLabs API key first.'))
  ipcMain.handle('voice:status', async () => ({ hasKey: !!(await readKey()) }))
  ipcMain.handle('voice:setKey', async (_e, key: string) => {
    key = String(key).trim()
    if (!safeStorage.isEncryptionAvailable()) throw new Error("This computer can't store the key securely.")
    const acct = await eleven.account(key) // a bad key fails here and is never stored
    await fs.writeFile(keyFile(), safeStorage.encryptString(key))
    return acct
  })
  ipcMain.handle('voice:clearKey', () => fs.rm(keyFile(), { force: true }))
  ipcMain.handle('voice:list', async () => eleven.listVoices(await needKey()))
  ipcMain.handle('voice:clone', async (_e, name: string, paths: string[]) => {
    const files = []
    for (const p of paths) {
      if (!MIME[extname(p).toLowerCase()]?.startsWith('audio/')) throw new Error(`${basename(p)} is not an audio file.`)
      files.push({ name: basename(p), data: await fs.readFile(p) })
    }
    if (!files.length || !String(name).trim()) throw new Error('Give the voice a name and pick at least one sample.')
    return eleven.cloneVoice(await needKey(), String(name).trim(), files)
  })
  ipcMain.handle('voice:speak', async (_e, projectId: string, voiceId: string, text: string) => {
    const mp3 = await eleven.speak(await needKey(), voiceId, String(text))
    const out = join(dir(projectId), 'voiceovers', `Speech ${new Date().toLocaleString('sv-SE').replace(/:/g, '-')}.mp3`)
    await fs.mkdir(dirname(out), { recursive: true })
    await fs.writeFile(out, mp3, { flag: 'wx' })
    return out
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111214', // = --c-bg, shown before the page paints
    title: 'Reelwright',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault()) // a file dropped outside the drop zone must not replace the app
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  protocol.handle('media', serveMedia)
  registerIpc()
  createWindow()
})
app.on('window-all-closed', () => app.quit())
