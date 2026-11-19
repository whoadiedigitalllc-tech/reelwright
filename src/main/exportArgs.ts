// Turns a project into ffmpeg arguments. Pure, so it can be tested without Electron.
// Must render the same picture as the preview in src/renderer/src/Player.tsx (same fit/transform/fade math).
import type { Project } from '../shared/schema'
import { FONTS, clipEnd, projectDuration } from '../shared/ops'

export interface ExportOptions {
  out: string
  short: number // short side of the output in px (720, 1080, 2160)
  fps: number
  tmpDir: string // text files for drawtext go here
  fontDir: string
}

// Numbers come from a JSON file on disk: never let NaN or a string reach the filter graph.
const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(4) : 0)
// Paths inside a quoted filter option: forward slashes, escape the drive colon and quotes.
const fpath = (s: string) => s.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
const even = (x: number) => Math.max(2, Math.round(x / 2) * 2)

export function buildExportArgs(p: Project, o: ExportOptions) {
  const total = n(projectDuration(p))
  if (total <= 0) throw new Error('Nothing to export: the timeline is empty.')
  const W = even(p.width)
  const H = even(p.height)
  const inputs: string[] = []
  const graph: string[] = [`color=c=black:s=${W}x${H}:r=${o.fps}:d=${total}[v0]`]
  const audio: string[] = []
  const textFiles: { path: string; text: string }[] = []
  let last = 'v0'
  let k = 0
  let input = 0

  for (const track of p.tracks) {
    for (const c of track.clips) {
      const start = n(c.start)
      const dur = n(c.duration)
      const end = n(clipEnd(c))
      const t = c.transform
      const fadeIn = n(c.fadeIn)
      const fadeOut = n(c.fadeOut)
      const enable = `enable='between(t,${start},${end})'`

      if (c.type === 'text') {
        if (track.hidden || !c.text.trim()) continue
        const file = `${o.tmpDir.replace(/\\/g, '/')}/text${k}.txt`
        textFiles.push({ path: file, text: c.text })
        const font = `${o.fontDir}/${FONTS[c.font] ?? FONTS.Arial}`
        const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#ffffff'
        let alpha = `${n(t.opacity)}`
        if (fadeIn) alpha += `*min(1,(t-${start})/${fadeIn})`
        if (fadeOut) alpha += `*min(1,(${end}-t)/${fadeOut})`
        graph.push(
          `[${last}]drawtext=fontfile='${fpath(font)}':textfile='${fpath(file)}':fontsize=${Math.round(n(c.size) * n(t.scale))}` +
            `:fontcolor=${color}:line_spacing=${Math.round(n(c.size) * n(t.scale) * 0.2)}` +
            `:x=(w-text_w)/2+${n(t.x)}:y=(h-text_h)/2+${n(t.y)}:alpha='max(0,${alpha})':${enable}[v${++k}]`
        )
        last = `v${k}`
        continue
      }

      const a = p.assets.find((x) => x.id === c.assetId)
      if (!a) throw new Error('A clip points at media that is no longer in the project.')
      if (a.offline) throw new Error(`Media file is missing: ${a.path}`)
      const i = input++
      if (a.kind === 'image') inputs.push('-loop', '1', '-framerate', String(o.fps), '-t', String(dur), '-i', a.path)
      else inputs.push('-i', a.path)
      const srcEnd = n(c.in + c.duration * c.speed)

      if (track.kind === 'video' && !track.hidden && a.kind !== 'audio') {
        const f = [
          a.kind === 'image' ? 'setpts=PTS-STARTPTS' : `trim=start=${n(c.in)}:end=${srcEnd},setpts=(PTS-STARTPTS)/${n(c.speed)}`,
          `fps=${o.fps}`,
          `scale=w=${Math.round(W * n(t.scale))}:h=${Math.round(H * n(t.scale))}:force_original_aspect_ratio=decrease`,
          'format=rgba'
        ]
        if (t.rotation) {
          const rad = n((t.rotation * Math.PI) / 180)
          f.push(`rotate=${rad}:ow=rotw(${rad}):oh=roth(${rad}):c=none`)
        }
        if (n(t.opacity) < 1) f.push(`colorchannelmixer=aa=${n(t.opacity)}`)
        if (fadeIn) f.push(`fade=t=in:st=0:d=${fadeIn}:alpha=1`)
        if (fadeOut) f.push(`fade=t=out:st=${n(dur - fadeOut)}:d=${fadeOut}:alpha=1`)
        f.push(`setpts=PTS+${start}/TB`)
        graph.push(`[${i}:v]${f.join(',')}[c${k}]`)
        graph.push(`[${last}][c${k}]overlay=x=(W-w)/2+${n(t.x)}:y=(H-h)/2+${n(t.y)}:eof_action=pass:${enable}[v${++k}]`)
        last = `v${k}`
      }

      if (!track.muted && a.hasAudio && n(c.volume) > 0) {
        const f = [`atrim=start=${n(c.in)}:end=${srcEnd}`, 'asetpts=PTS-STARTPTS']
        if (n(c.speed) !== 1) f.push(`atempo=${n(c.speed)}`)
        f.push(`volume=${n(c.volume)}`)
        if (fadeIn) f.push(`afade=t=in:st=0:d=${fadeIn}`)
        if (fadeOut) f.push(`afade=t=out:st=${n(dur - fadeOut)}:d=${fadeOut}`)
        f.push(`adelay=${Math.round(start * 1000)}:all=1`)
        graph.push(`[${i}:a]${f.join(',')}[a${audio.length}]`)
        audio.push(`[a${audio.length}]`)
      }
    }
  }

  graph.push(
    audio.length
      ? `${audio.join('')}amix=inputs=${audio.length}:normalize=0:duration=longest,apad,atrim=end=${total}[aout]`
      : `anullsrc=r=48000:cl=stereo,atrim=end=${total}[aout]`
  )
  const f = o.short / Math.min(W, H)
  graph.push(`[${last}]scale=${even(W * f)}:${even(H * f)},format=yuv420p[vout]`)

  const args = [
    '-y', '-hide_banner', ...inputs,
    '-filter_complex', graph.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', String(o.fps),
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
    '-t', String(total), '-progress', 'pipe:1', '-nostats', o.out
  ]
  return { args, duration: total, textFiles }
}
