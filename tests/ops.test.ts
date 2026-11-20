import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import type { MediaAsset } from '../src/shared/schema'
import { fadeFactor, hexRgb, keyAlpha, mediaClip, moveMain, newProject, place, projectDuration, remove, setSpeed, split, textClip } from '../src/shared/ops'

const vid = (id: string, duration: number): MediaAsset => ({ id, path: `C:/${id}.mp4`, kind: 'video', duration, hasAudio: true })
const aud: MediaAsset = { id: 'a', path: 'C:/a.mp3', kind: 'audio', duration: 10, hasAudio: true }

function setup() {
  const p = newProject('t')
  p.assets.push(vid('v1', 4), vid('v2', 6), aud)
  return produce(p, (d) => {
    place(d, mediaClip(d.assets[0]), Infinity, d.tracks[0].id)
    place(d, mediaClip(d.assets[1]), Infinity, d.tracks[0].id)
  })
}

describe('timeline ops', () => {
  it('main track is magnetic: clips are packed back to back', () => {
    const p = setup()
    expect(p.tracks[0].clips.map((c) => [c.start, c.duration])).toEqual([[0, 4], [4, 6]])
    expect(projectDuration(p)).toBe(10)
  })

  it('split keeps total length and offsets the source in-point', () => {
    const p = setup()
    const id = p.tracks[0].clips[1].id
    const q = produce(p, (d) => void split(d, id, 7))
    const [, l, r] = q.tracks[0].clips
    expect([l.start, l.duration, r.start, r.duration]).toEqual([4, 3, 7, 3])
    expect(r.type === 'media' && r.in).toBe(3)
    expect(projectDuration(q)).toBe(10)
  })

  it('split outside the clip does nothing', () => {
    const p = setup()
    expect(produce(p, (d) => void split(d, d.tracks[0].clips[0].id, 9))).toBe(p)
  })

  it('delete on the main track ripples', () => {
    const p = produce(setup(), (d) => remove(d, d.tracks[0].clips[0].id))
    expect(p.tracks[0].clips[0].start).toBe(0)
    expect(projectDuration(p)).toBe(6)
  })

  it('reorder by drop position', () => {
    const p = setup()
    const first = p.tracks[0].clips[0].id
    const q = produce(p, (d) => moveMain(d.tracks[0], first, 9))
    expect(q.tracks[0].clips[1].id).toBe(first)
    expect(q.tracks[0].clips[0].start).toBe(0)
  })

  it('audio and text go on their own tracks; overlaps open a new track; empty tracks are removed', () => {
    let p = produce(setup(), (d) => {
      place(d, mediaClip(d.assets[2]), 1)
      place(d, textClip(0), 0)
      place(d, textClip(1), 1) // overlaps the first text clip
    })
    expect(p.tracks.map((t) => t.kind)).toEqual(['video', 'audio', 'text', 'text'])
    p = produce(p, (d) => remove(d, d.tracks[3].clips[0].id))
    expect(p.tracks.length).toBe(3)
  })

  it('speed keeps the same source span', () => {
    const p = produce(setup(), (d) => setSpeed(d, d.tracks[0].clips[1].id, 2))
    expect(p.tracks[0].clips[1].duration).toBe(3)
    expect(projectDuration(p)).toBe(7)
  })

  it('fade factor', () => {
    const c = { ...textClip(0), duration: 4, fadeIn: 1, fadeOut: 2 }
    expect(fadeFactor(c, 0.5)).toBe(0.5)
    expect(fadeFactor(c, 2)).toBe(1)
    expect(fadeFactor(c, 3)).toBe(0.5)
  })
})

describe('chroma key alpha (matches ffmpeg colorkey)', () => {
  const g = hexRgb('#00ff00')
  it('removes the key colour, keeps far colours, blends the edge', () => {
    expect(g).toEqual([0, 255, 0])
    expect(keyAlpha(0, 255, 0, g, 0.3, 0.1)).toBe(0)
    expect(keyAlpha(255, 0, 0, g, 0.3, 0.1)).toBe(1)
    const edge = keyAlpha(0, 255 - 155, 0, g, 0.3, 0.1) // diff ~0.358: inside the blend band
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(1)
    expect(keyAlpha(0, 200, 0, g, 0.3, 0)).toBe(0) // hard edge when blend is 0
  })
})
