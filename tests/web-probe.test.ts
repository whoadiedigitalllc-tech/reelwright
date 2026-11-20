// The web build reads media facts from `ffmpeg -i` output (no ffprobe in the browser). Check the parser on real output.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import ffmpeg from 'ffmpeg-static'
import { parseProbe } from '../src/web/probe'

const FF = ffmpeg as unknown as string
const dir = mkdtempSync(join(tmpdir(), 've-probe-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const info = (args: string[], file: string) => {
  execFileSync(FF, ['-v', 'error', ...args, join(dir, file)])
  try {
    execFileSync(FF, ['-hide_banner', '-i', join(dir, file)], { stdio: 'pipe' })
  } catch (e) {
    return parseProbe(String((e as { stderr: Buffer }).stderr)) // `-i` alone exits 1 after printing the info
  }
  throw new Error('expected ffmpeg -i to exit 1')
}

it('video with audio', () => {
  const r = info(['-f', 'lavfi', '-i', 'testsrc2=s=640x360:d=2', '-f', 'lavfi', '-i', 'sine=d=2', '-shortest', '-pix_fmt', 'yuv420p'], 'a.mp4')
  expect(r).toMatchObject({ video: true, audio: true, width: 640, height: 360 })
  expect(r.duration).toBeCloseTo(2, 0)
})
it('silent video', () => {
  expect(info(['-f', 'lavfi', '-i', 'testsrc2=s=320x240:d=1', '-pix_fmt', 'yuv420p'], 'b.mp4')).toMatchObject({ video: true, audio: false, width: 320 })
})
it('audio only', () => {
  expect(info(['-f', 'lavfi', '-i', 'sine=d=1'], 'c.wav')).toMatchObject({ video: false, audio: true })
})
it('image', () => {
  expect(info(['-f', 'lavfi', '-i', 'testsrc=s=200x100', '-frames:v', '1'], 'd.png')).toMatchObject({ video: true, audio: false, width: 200, height: 100 })
})
