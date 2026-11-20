// Project document. Stored as JSON at <userData>/projects/<id>/project.json.
// Bump `version` and migrate in readProject() (src/main/index.ts) when this shape changes.

export type Id = string

export interface Project {
  version: 1
  id: Id
  name: string
  createdAt: string // ISO 8601 UTC
  updatedAt: string
  width: number // canvas px
  height: number
  fps: number
  assets: MediaAsset[]
  tracks: Track[] // array order = stacking order; tracks[0] is the main (magnetic) video track
}

export interface MediaAsset {
  id: Id
  path: string // absolute, never copied
  kind: 'video' | 'audio' | 'image'
  duration: number // seconds; 0 for images
  width?: number
  height?: number
  hasAudio: boolean
  thumb?: string // absolute path to a jpg
  offline?: boolean // set on load when the file is missing; not saved
}

export interface Track {
  id: Id
  kind: 'video' | 'audio' | 'text'
  muted: boolean
  hidden: boolean
  clips: Clip[] // sorted by start, never overlapping
}

export interface Transform {
  x: number // px offset from canvas centre
  y: number
  scale: number // 1 = fit inside the canvas
  rotation: number // degrees, clockwise
  opacity: number // 0..1
}

interface ClipBase {
  id: Id
  start: number // timeline seconds
  duration: number // timeline seconds (after speed)
  transform: Transform
  fadeIn: number // seconds; fades picture (to what is below) and sound
  fadeOut: number
}

export interface MediaClip extends ClipBase {
  type: 'media'
  assetId: Id
  in: number // source seconds
  speed: number // 0.5..4
  volume: number // 0..2
  chromaKey?: ChromaKey // video and image clips only
}

export interface ChromaKey {
  color: string // #rrggbb, the background colour to remove
  similarity: number // 0.01..1, how close a pixel must be to count as background
  blend: number // 0..1, soft edge width
}

export interface TextClip extends ClipBase {
  type: 'text'
  text: string
  font: string // key of FONTS
  size: number // px at canvas resolution
  color: string // #rrggbb
}

export type Clip = MediaClip | TextClip
