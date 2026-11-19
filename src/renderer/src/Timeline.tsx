import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { Eye, EyeOff, Redo2, Scissors, Trash2, Undo2, Volume2, VolumeX } from 'lucide-react'
import type { Clip, Project, Track } from '../../shared/schema'
import {
  assetOf, clamp, clipEnd, fits, isMain, locate, maxDuration, mediaClip, moveMain, pack, place, projectDuration, snapTime, sortClips
} from '../../shared/ops'
import { ASSET_MIME, mediaUrl, useEditor } from './store'
import { Button } from './ui'

const HEAD = 84 // track header width, px
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]

export function Timeline() {
  const project = useEditor((s) => s.project)!
  const pps = useEditor((s) => s.pps)
  const selected = useEditor((s) => s.selected)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const st = useEditor.getState()
  const scroll = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number } | null>(null) // main-track reorder preview
  const width = Math.max((projectDuration(project) + 30) * pps, 1200)
  const empty = project.tracks.every((t) => t.clips.length === 0)

  const dropAsset = (e: React.DragEvent, trackId: string | 'new') => {
    const a = project.assets.find((x) => x.id === e.dataTransfer.getData(ASSET_MIME))
    if (!a) return
    e.preventDefault()
    const at = (e.clientX - e.currentTarget.getBoundingClientRect().left) / pps
    st.commit((d) => place(d, mediaClip(a), at, trackId))
  }
  const allowDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(ASSET_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }
  const scrub = (e: RPE<HTMLDivElement>) => {
    const el = e.currentTarget
    const at = (x: number) => st.seek((x - el.getBoundingClientRect().left) / pps)
    at(e.clientX)
    el.setPointerCapture(e.pointerId)
    el.onpointermove = (ev) => at(ev.clientX)
    el.onpointerup = () => (el.onpointermove = null)
  }

  const step = STEPS.find((s) => s * pps >= 70) ?? 600
  const ticks = Array.from({ length: Math.ceil(width / pps / step) }, (_, i) => i * step)

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="tl-toolbar">
        <Button icon variant="ghost" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={st.undo}><Undo2 size={16} aria-hidden /></Button>
        <Button icon variant="ghost" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={st.redo}><Redo2 size={16} aria-hidden /></Button>
        <Button icon variant="ghost" aria-label="Split at playhead (S)" title="Split at playhead (S)" disabled={empty} onClick={st.splitAtPlayhead}><Scissors size={16} aria-hidden /></Button>
        <Button icon variant="ghost" aria-label="Delete clip (Del)" title="Delete clip (Del)" disabled={!selected} onClick={st.removeSelected}><Trash2 size={16} aria-hidden /></Button>
        <span className="spacer" />
        <label className="zoom">
          Zoom
          <input type="range" min={10} max={400} value={pps} onChange={(e) => useEditor.setState({ pps: +e.target.value })} />
        </label>
      </div>
      <div className="tl-scroll" ref={scroll}>
        <div className="tl-inner" style={{ width: width + HEAD }}>
          <div className="tl-row tl-ruler-row">
            <div className="tl-head" />
            <div className="tl-ruler" onPointerDown={scrub} title="Click or drag to move the playhead (arrow keys step frames)">
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ left: t * pps }}>
                  {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
          {[...project.tracks].reverse().map((t) => (
            <div key={t.id} className={`tl-row tl-track kind-${t.kind}${isMain(project, t) ? ' main' : ''}`}>
              <TrackHead track={t} main={isMain(project, t)} />
              <div
                className="tl-lane"
                onDragOver={allowDrop}
                onDrop={(e) => dropAsset(e, t.id)}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return
                  st.select(null)
                  st.seek((e.clientX - e.currentTarget.getBoundingClientRect().left) / pps)
                }}
              >
                {isMain(project, t) && t.clips.length === 0 && <span className="lane-hint">Drag clips from Media to start your timeline.</span>}
                {t.clips.map((c) => (
                  <ClipView key={c.id} clip={c} track={t} project={project} pps={pps} selected={c.id === selected} dx={drag?.id === c.id ? drag.dx : 0} setDrag={setDrag} />
                ))}
              </div>
            </div>
          ))}
          <div className="tl-row tl-new">
            <div className="tl-head" />
            <div className="tl-lane" onDragOver={allowDrop} onDrop={(e) => dropAsset(e, 'new')}>
              <span className="lane-hint">Drop here for a new track</span>
            </div>
          </div>
          <Playhead scroll={scroll} />
        </div>
      </div>
    </section>
  )
}

function TrackHead({ track, main }: { track: Track; main: boolean }) {
  const commit = useEditor((s) => s.commit)
  const toggle = (k: 'muted' | 'hidden') => commit((d) => void (d.tracks.find((x) => x.id === track.id)![k] = !track[k]))
  const name = main ? 'Main' : track.kind === 'audio' ? 'Audio' : track.kind === 'text' ? 'Text' : 'Overlay'
  return (
    <div className="tl-head">
      <span className="tl-name">{name}</span>
      {track.kind !== 'text' && (
        <Button icon variant="ghost" aria-label={track.muted ? `Unmute ${name}` : `Mute ${name}`} aria-pressed={track.muted} onClick={() => toggle('muted')}>
          {track.muted ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
        </Button>
      )}
      {track.kind !== 'audio' && (
        <Button icon variant="ghost" aria-label={track.hidden ? `Show ${name}` : `Hide ${name}`} aria-pressed={track.hidden} onClick={() => toggle('hidden')}>
          {track.hidden ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        </Button>
      )}
    </div>
  )
}

function ClipView(props: {
  clip: Clip
  track: Track
  project: Project
  pps: number
  selected: boolean
  dx: number
  setDrag: (d: { id: string; dx: number } | null) => void
}) {
  const { clip: c, track, project, pps, selected, dx, setDrag } = props
  const a = assetOf(project, c)
  const main = isMain(project, track)
  const label = c.type === 'text' ? c.text : a?.path.split(/[\\/]/).pop() ?? 'Missing media'

  const down = (mode: 'move' | 'l' | 'r') => (e: RPE) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const st = useEditor.getState()
    st.select(c.id)
    st.begin()
    const o = c
    const x0 = e.clientX
    const p0 = st.project!
    const frame = 1 / p0.fps
    const edges = [st.time, 0, ...p0.tracks.flatMap((t) => t.clips.filter((x) => x.id !== o.id).flatMap((x) => [x.start, clipEnd(x)]))]
    const thr = 8 / pps
    const max = maxDuration(p0, o)
    const hasIn = o.type === 'media' && a?.kind !== 'image'
    let moved = false
    const upd = (fn: (x: Clip, t: Track) => void) =>
      st.live((d) => {
        const l = locate(d, o.id)!
        fn(l.clip, l.track)
        if (main) pack(l.track)
      })

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) > 3) moved = true
      if (!moved) return
      const dt = (ev.clientX - x0) / pps
      if (mode === 'move') {
        if (main) return setDrag({ id: o.id, dx: ev.clientX - x0 })
        const s = Math.max(0, o.start + dt)
        const a1 = snapTime(s, edges, thr)
        const a2 = snapTime(s + o.duration, edges, thr) - o.duration
        upd((x) => void (x.start = Math.max(0, a1 !== s ? a1 : a2)))
      } else if (mode === 'r') {
        const dur = clamp(snapTime(clipEnd(o) + dt, edges, thr) - o.start, frame, max)
        upd((x) => void (x.duration = dur))
      } else {
        let delta = snapTime(o.start + dt, edges, thr) - o.start
        const lo = Math.max(hasIn && o.type === 'media' ? -o.in / o.speed : -Infinity, main ? -Infinity : -o.start)
        delta = clamp(delta, lo, o.duration - frame)
        upd((x) => {
          x.duration = o.duration - delta
          if (x.type === 'media' && o.type === 'media') x.in = o.in + delta * o.speed
          if (!main) x.start = o.start + delta
        })
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      const s = useEditor.getState()
      if (mode === 'move' && moved) {
        if (main) {
          setDrag(null)
          s.live((d) => moveMain(d.tracks[0], o.id, o.start + (ev.clientX - x0) / pps + o.duration / 2))
        } else {
          const l = locate(s.project!, o.id)!
          if (fits(l.track, l.clip.start, l.clip.duration, o.id)) s.live((d) => sortClips(locate(d, o.id)!.track))
          else {
            s.live((d) => void (locate(d, o.id)!.clip.start = o.start))
            s.toast('Another clip is already there.')
          }
        }
      }
      s.end()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }

  return (
    <div
      className={`clip clip-${c.type === 'text' ? 'text' : a?.kind ?? 'video'}${selected ? ' selected' : ''}${a?.offline ? ' offline' : ''}${dx ? ' dragging' : ''}`}
      style={{
        left: c.start * pps,
        width: Math.max(c.duration * pps, 4),
        transform: dx ? `translateX(${dx}px)` : undefined,
        backgroundImage: a?.thumb ? `url("${mediaUrl(a.thumb)}")` : undefined
      }}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`${label}, ${c.duration.toFixed(1)} seconds`}
      onPointerDown={down('move')}
      onKeyDown={(e) => e.key === 'Enter' && useEditor.getState().select(c.id)}
    >
      <span className="clip-handle l" onPointerDown={down('l')} aria-hidden />
      <span className="clip-label">{label}</span>
      <span className="clip-handle r" onPointerDown={down('r')} aria-hidden />
    </div>
  )
}

function Playhead({ scroll }: { scroll: React.RefObject<HTMLDivElement> }) {
  const time = useEditor((s) => s.time)
  const pps = useEditor((s) => s.pps)
  const playing = useEditor((s) => s.playing)
  const x = HEAD + time * pps
  useEffect(() => {
    const el = scroll.current
    if (playing && el && (x > el.scrollLeft + el.clientWidth - 40 || x < el.scrollLeft + HEAD)) el.scrollLeft = x - HEAD - 40
  }, [x, playing, scroll])
  return <div className="tl-playhead" style={{ left: x }} aria-hidden />
}
