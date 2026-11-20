// Mic recordings are re-encoded to WAV in the renderer; check ffprobe reads what we write.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it } from 'vitest'
import ffprobe from 'ffprobe-static'
import { encodeWav } from '../src/renderer/src/wav'

const dir = mkdtempSync(join(tmpdir(), 've-wav-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

it('writes a mono 16-bit WAV ffprobe reads with the right length', () => {
  const rate = 8000
  const s = new Float32Array(rate * 1.5).map((_, i) => Math.sin(i / 10) * 1.5) // out of range on purpose: must clamp
  const buf = encodeWav(s, rate)
  const v = new DataView(buf)
  expect(v.getInt16(44 + 15 * 2, true)).toBe(0x7fff) // sin(1.5)*1.5 > 1 -> clamped
  const file = join(dir, 'a.wav')
  writeFileSync(file, Buffer.from(buf))
  const out = JSON.parse(execFileSync(ffprobe.path, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).toString())
  expect(out.streams[0]).toMatchObject({ codec_name: 'pcm_s16le', channels: 1, sample_rate: '8000' })
  expect(parseFloat(out.format.duration)).toBeCloseTo(1.5, 3)
})
