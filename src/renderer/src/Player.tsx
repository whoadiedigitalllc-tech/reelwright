import { useEffect, useRef } from 'react'
import { Pause, Play } from 'lucide-react'
import type { Clip, Transform } from '../../shared/schema'
import { ASPECTS, clipEnd, fadeFactor, projectDuration, timecode } from '../../shared/ops'
import { mediaUrl, useEditor } from './store'
import { Button } from './ui'

// Preview compositor. Mirrors src/main/exportArgs.ts: media is fitted inside the canvas, then scaled,
// rotated and offset from the centre; fades multiply opacity and volume.
export function Player() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const project = useEditor((s) => s.project)!
  const playing = useEditor((s) => s.playing)
  const time = useEditor((s) => s.time)
  const { togglePlay, commit } = useEditor.getState()

  useEffect(() => {
    const videos = new Map<string, HTMLVideoElement>() // one element per clip
    const images = new Map<string, HTMLImageElement>() // per asset
    let raf = 0
    let prev = performance.now()

    const tick = (now: number) => {
      const s = useEditor.getState()
      const p = s.project
      const ctx = canvas.current?.getContext('2d')
      if (!p || !ctx) {
        raf = requestAnimationFrame(tick)
        return
      }
      let t = s.time
      if (s.playing) {
        const d = projectDuration(p)
        t = Math.min(d, t + (now - prev) / 1000)
        useEditor.setState(t >= d ? { time: d, playing: false } : { time: t })
      }
      prev = now
      const W = p.width
      const H = p.height
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      const draw = (src: CanvasImageSource, iw: number, ih: number, tr: Transform, alpha: number) => {
        const k = Math.min(W / iw, H / ih) * tr.scale
        ctx.save()
        ctx.globalAlpha = tr.opacity * alpha
        ctx.translate(W / 2 + tr.x, H / 2 + tr.y)
        ctx.rotate((tr.rotation * Math.PI) / 180)
        ctx.drawImage(src, (-iw * k) / 2, (-ih * k) / 2, iw * k, ih * k)
        ctx.restore()
      }
      const drawText = (c: Extract<Clip, { type: 'text' }>, alpha: number) => {
        const size = c.size * c.transform.scale
        const lines = c.text.split('\n')
        ctx.save()
        ctx.globalAlpha = c.transform.opacity * alpha
        ctx.font = `${size}px "${c.font}"`
        ctx.fillStyle = c.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const lh = size * 1.2
        lines.forEach((line, i) => ctx.fillText(line, W / 2 + c.transform.x, H / 2 + c.transform.y + (i - (lines.length - 1) / 2) * lh))
        ctx.restore()
      }

      const active = new Set<string>()
      const alive = new Set<string>()
      for (const track of p.tracks) {
        for (const c of track.clips) {
          alive.add(c.id)
          if (t < c.start || t >= clipEnd(c)) continue
          const local = t - c.start
          const fade = fadeFactor(c, local)
          if (c.type === 'text') {
            if (!track.hidden) drawText(c, fade)
            continue
          }
          const a = p.assets.find((x) => x.id === c.assetId)
          if (!a || a.offline) continue
          if (a.kind === 'image') {
            let img = images.get(a.id)
            if (!img) images.set(a.id, (img = Object.assign(new Image(), { src: mediaUrl(a.path) })))
            if (img.complete && img.naturalWidth && !track.hidden) draw(img, img.naturalWidth, img.naturalHeight, c.transform, fade)
            continue
          }
          let v = videos.get(c.id)
          if (!v) {
            v = document.createElement('video')
            v.preload = 'auto'
            v.src = mediaUrl(a.path)
            videos.set(c.id, v)
          }
          active.add(c.id)
          const src = c.in + local * c.speed
          v.muted = track.muted
          v.volume = Math.min(1, c.volume * fade)
          v.playbackRate = c.speed
          if (s.playing) {
            if (v.paused) v.play().catch(() => {})
            if (!v.seeking && Math.abs(v.currentTime - src) > 0.3) v.currentTime = src
          } else {
            if (!v.paused) v.pause()
            if (!v.seeking && Math.abs(v.currentTime - src) > 0.5 / p.fps) v.currentTime = src
          }
          if (track.kind === 'video' && !track.hidden && a.kind === 'video' && v.readyState >= 2 && v.videoWidth)
            draw(v, v.videoWidth, v.videoHeight, c.transform, fade)
        }
      }
      for (const [id, v] of videos) {
        if (active.has(id)) continue
        if (!v.paused) v.pause()
        if (!alive.has(id)) {
          v.removeAttribute('src')
          v.load()
          videos.delete(id)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      for (const v of videos.values()) {
        v.pause()
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [project.id])

  const aspect = Object.entries(ASPECTS).find(([, [w, h]]) => w === project.width && h === project.height)?.[0] ?? 'custom'

  return (
    <section className="player" aria-label="Preview">
      <div className="player-stage">
        <canvas ref={canvas} width={project.width} height={project.height} />
      </div>
      <div className="player-bar">
        <span className="tc">{timecode(time, project.fps)} / {timecode(projectDuration(project), project.fps)}</span>
        <Button icon variant="ghost" aria-label={playing ? 'Pause (Space)' : 'Play (Space)'} title="Space" onClick={togglePlay}>
          {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </Button>
        <select
          aria-label="Canvas aspect ratio"
          value={aspect}
          onChange={(e) => {
            const [w, h] = ASPECTS[e.target.value]
            commit((d) => {
              d.width = w
              d.height = h
            })
          }}
        >
          {aspect === 'custom' && <option value="custom">Custom</option>}
          {Object.keys(ASPECTS).map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>
    </section>
  )
}
