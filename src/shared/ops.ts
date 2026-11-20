// Timeline operations. They mutate the project they are given, so call them inside immer's produce().
import type { Clip, Id, MediaAsset, MediaClip, Project, TextClip, Track, Transform } from './schema'

export const uid = (): Id => crypto.randomUUID()

// Windows font files in C:\Windows\Fonts. Preview uses the family name, export uses the file.
export const FONTS: Record<string, string> = {
  Arial: 'arial.ttf',
  'Segoe UI': 'segoeui.ttf',
  Georgia: 'georgia.ttf',
  Impact: 'impact.ttf',
  Verdana: 'verdana.ttf',
  Consolas: 'consola.ttf'
}

export const ASPECTS: Record<string, [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350]
}

export const IMAGE_SECONDS = 3
export const clipEnd = (c: Clip) => c.start + c.duration
export const projectDuration = (p: Project) =>
  p.tracks.reduce((m, t) => t.clips.reduce((n, c) => Math.max(n, clipEnd(c)), m), 0)
export const transform = (): Transform => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 })
export const newTrack = (kind: Track['kind']): Track => ({ id: uid(), kind, muted: false, hidden: false, clips: [] })
export const isMain = (p: Project, t: Track) => p.tracks[0].id === t.id
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function newProject(name: string, [width, height] = ASPECTS['16:9'], fps = 30): Project {
  const now = new Date().toISOString()
  return { version: 1, id: uid(), name, createdAt: now, updatedAt: now, width, height, fps, assets: [], tracks: [newTrack('video')] }
}

export function mediaClip(a: MediaAsset, start = 0): MediaClip {
  const duration = a.kind === 'image' ? IMAGE_SECONDS : a.duration
  return { id: uid(), type: 'media', assetId: a.id, start, duration, in: 0, speed: 1, volume: 1, fadeIn: 0, fadeOut: 0, transform: transform() }
}

export function textClip(start = 0, style: Partial<TextClip> = {}): TextClip {
  return {
    id: uid(), type: 'text', start, duration: 3, text: 'Your text', font: 'Arial', size: 96, color: '#ffffff',
    fadeIn: 0, fadeOut: 0, transform: transform(), ...style
  }
}

export function locate(p: Project, id: Id) {
  for (const track of p.tracks) {
    const index = track.clips.findIndex((c) => c.id === id)
    if (index >= 0) return { track, clip: track.clips[index], index }
  }
}

export const assetOf = (p: Project, c: Clip) => (c.type === 'media' ? p.assets.find((a) => a.id === c.assetId) : undefined)

// Longest a clip can get from its current in-point (source media runs out). Images and text: unlimited.
export function maxDuration(p: Project, c: Clip) {
  const a = assetOf(p, c)
  if (c.type === 'text' || !a || a.kind === 'image') return Infinity
  return (a.duration - c.in) / c.speed
}

export function pack(t: Track) {
  let s = 0
  for (const c of t.clips) {
    c.start = s
    s += c.duration
  }
}

export const sortClips = (t: Track) => t.clips.sort((a, b) => a.start - b.start)

export function fits(t: Track, start: number, duration: number, ignore?: Id) {
  const eps = 1e-6
  return start >= -eps && t.clips.every((c) => c.id === ignore || start + duration <= c.start + eps || start >= clipEnd(c) - eps)
}

const kindFor = (p: Project, c: Clip): Track['kind'] =>
  c.type === 'text' ? 'text' : assetOf(p, c)?.kind === 'audio' ? 'audio' : 'video'

// Main track is magnetic: insert at the slot nearest `at`, then close gaps.
export function insertMain(t: Track, c: Clip, at: number) {
  const i = t.clips.filter((o) => o.start + o.duration / 2 < at).length
  t.clips.splice(i, 0, c)
  pack(t)
}

/**
 * Put a clip on the timeline at `at` seconds.
 * trackId: drop on that track if the kind matches and there is room; 'new': always a new track;
 * undefined: first track of the right kind with room, else a new one on top.
 */
export function place(p: Project, c: Clip, at: number, trackId?: Id | 'new') {
  const kind = kindFor(p, c)
  const target = p.tracks.find((t) => t.id === trackId && t.kind === kind)
  if (target && isMain(p, target)) return insertMain(target, c, at)
  c.start = Math.max(0, at)
  let t: Track | undefined
  if (trackId !== 'new') {
    t = target && fits(target, c.start, c.duration) ? target : undefined
    t ??= p.tracks.find((o, i) => i > 0 && o.kind === kind && fits(o, c.start, c.duration))
  }
  if (!t) {
    p.tracks.push(newTrack(kind))
    t = p.tracks[p.tracks.length - 1]
  }
  t.clips.push(c)
  sortClips(t)
}

// Split at timeline time t. Returns the new right-hand clip's id, or undefined if t is not inside the clip.
export function split(p: Project, id: Id, t: number): Id | undefined {
  const l = locate(p, id)
  if (!l) return
  const { track, clip: c, index } = l
  const local = t - c.start
  const frame = 1 / p.fps
  if (local < frame || local > c.duration - frame) return
  const r = { ...c, transform: { ...c.transform }, id: uid(), start: t, duration: c.duration - local, fadeIn: 0 } as Clip
  if (r.type === 'media' && c.type === 'media') r.in = c.in + local * c.speed
  c.duration = local
  c.fadeOut = 0
  track.clips.splice(index + 1, 0, r)
  return r.id
}

// Delete a clip. Main track closes the gap (ripple). Empty extra tracks are removed.
export function remove(p: Project, id: Id) {
  const l = locate(p, id)
  if (!l) return
  l.track.clips.splice(l.index, 1)
  if (isMain(p, l.track)) pack(l.track)
  p.tracks = p.tracks.filter((t, i) => i === 0 || t.clips.length > 0)
}

export function moveMain(t: Track, id: Id, center: number) {
  const i = t.clips.findIndex((c) => c.id === id)
  if (i < 0) return
  const [c] = t.clips.splice(i, 1)
  insertMain(t, c, center)
}

// Change speed, keeping the same stretch of source media.
export function setSpeed(p: Project, id: Id, speed: number) {
  const l = locate(p, id)
  if (!l || l.clip.type !== 'media') return
  const c = l.clip
  const span = c.duration * c.speed
  c.speed = speed
  c.duration = span / speed
  c.fadeIn = Math.min(c.fadeIn, c.duration / 2)
  c.fadeOut = Math.min(c.fadeOut, c.duration / 2)
  if (isMain(p, l.track)) pack(l.track)
}

export function snapTime(t: number, candidates: number[], threshold: number) {
  let best = t
  let d = threshold
  for (const c of candidates) {
    if (Math.abs(c - t) < d) {
      d = Math.abs(c - t)
      best = c
    }
  }
  return best
}

export const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Alpha 0..1 for one pixel. Same formula as ffmpeg's colorkey filter (export), so the preview matches the file.
export function keyAlpha(r: number, g: number, b: number, [kr, kg, kb]: number[], similarity: number, blend: number) {
  const diff = Math.sqrt(((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) / (3 * 255 * 255))
  return blend > 0.0001 ? clamp((diff - similarity) / blend, 0, 1) : diff > similarity ? 1 : 0
}

// 0..1 multiplier for picture opacity and volume at `local` seconds into the clip.
export function fadeFactor(c: Clip, local: number) {
  let f = 1
  if (c.fadeIn > 0) f = Math.min(f, local / c.fadeIn)
  if (c.fadeOut > 0) f = Math.min(f, (c.duration - local) / c.fadeOut)
  return clamp(f, 0, 1)
}

export function timecode(t: number, fps: number) {
  const f = Math.floor((t % 1) * fps + 1e-6)
  const s = Math.floor(t) % 60
  const m = Math.floor(t / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(m)}:${pad(s)}:${pad(f)}`
}
