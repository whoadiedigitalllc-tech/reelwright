// Real render through the bundled ffmpeg: proves the filter graph is valid and the output length is right.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { produce } from 'immer'
import ffmpeg from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import type { MediaAsset } from '../src/shared/schema'
import { mediaClip, newProject, place, setSpeed, split, textClip } from '../src/shared/ops'
import { buildExportArgs } from '../src/main/exportArgs'

const FF = ffmpeg as unknown as string
const dir = mkdtempSync(join(tmpdir(), 've-test-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const lengthOf = (f: string) =>
  parseFloat(execFileSync(ffprobe.path, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())

describe('export', () => {
  it('rejects an empty timeline', () => {
    expect(() => buildExportArgs(newProject('e'), { out: 'x.mp4', short: 720, fps: 30, tmpDir: dir, fontDir: '' })).toThrow(/empty/)
  })

  it('renders video + image + audio + text with split, speed, fades and transform', () => {
    const clip = join(dir, 'in.mp4')
    const png = join(dir, 'in.png')
    const wav = join(dir, 'in.wav')
    execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=4', '-f', 'lavfi', '-i', 'sine=d=4', '-shortest', '-pix_fmt', 'yuv420p', clip])
    execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=400x400', '-frames:v', '1', png])
    execFileSync(FF, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=f=220:d=3', wav])

    const assets: MediaAsset[] = [
      { id: 'v', path: clip, kind: 'video', duration: 4, hasAudio: true },
      { id: 'i', path: png, kind: 'image', duration: 0, hasAudio: false },
      { id: 'a', path: wav, kind: 'audio', duration: 3, hasAudio: true }
    ]
    const base = newProject('t', [1080, 1920])
    base.assets = assets
    const p = produce(base, (d) => {
      place(d, mediaClip(assets[0]), Infinity, d.tracks[0].id) // 0-4
      split(d, d.tracks[0].clips[0].id, 2)
      setSpeed(d, d.tracks[0].clips[1].id, 2) // second half 2s -> 1s: main = 3s
      d.tracks[0].clips[0].fadeIn = 0.5
      place(d, mediaClip(assets[1]), Infinity, d.tracks[0].id) // image 3s: main = 6s
      const ov = mediaClip(assets[0], 1)
      ov.transform = { x: 200, y: -300, scale: 0.4, rotation: 15, opacity: 0.8 }
      place(d, ov, 1) // overlay track 1-5
      place(d, mediaClip(assets[2]), 2) // audio 2-5
      place(d, textClip(0.5, { text: "It's 50%: done\nline two", fadeOut: 0.5 }), 0.5)
    })

    const out = join(dir, 'out.mp4')
    const { args, duration, textFiles } = buildExportArgs(p, {
      out, short: 360, fps: 30, tmpDir: dir, fontDir: join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts')
    })
    expect(duration).toBe(6)
    for (const f of textFiles) writeFileSync(f.path, f.text)
    execFileSync(FF, args.filter((a) => a !== 'pipe:1' && a !== '-progress'), { stdio: 'pipe' })
    expect(lengthOf(out)).toBeCloseTo(6, 0)
    const size = execFileSync(ffprobe.path, ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out]).toString().trim()
    expect(size).toBe('360,640')
  }, 120_000)
})
