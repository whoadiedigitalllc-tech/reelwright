// Project document schema. Stored as JSON at <userData>/projects/<id>/project.json.
// Bump `version` and add a migration in loadProject() when this shape changes.

export type Id = string; // crypto.randomUUID()

export interface Project {
  version: 1;
  id: Id;
  name: string;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string;
  width: number;  // canvas px, e.g. 1920
  height: number; // e.g. 1080 (9:16 => 1080x1920)
  fps: number;    // 30 default
  assets: MediaAsset[];
  tracks: Track[]; // order = array order; index 0 is the main video track (bottom of the stack)
}

export interface MediaAsset {
  id: Id;
  path: string; // absolute path, never copied
  kind: 'video' | 'audio' | 'image';
  duration: number; // seconds; images: 0 (clip sets length)
  width?: number;
  height?: number;
  hasAudio: boolean;
  offline?: boolean; // set on load when path is missing; not persisted meaningfully
}

export interface Track {
  id: Id;
  kind: 'video' | 'audio' | 'text';
  muted: boolean;
  hidden: boolean;
  clips: Clip[];             // sorted by start, never overlapping (enforced in the store)
  transitions: Transition[]; // only on video tracks
}

export interface Transform { x: number; y: number; scale: number; rotation: number; opacity: number }

interface ClipBase {
  id: Id;
  start: number; // timeline seconds
  duration: number; // timeline seconds (after speed)
  transform: Transform;
}

export interface MediaClip extends ClipBase {
  type: 'media';
  assetId: Id;
  in: number; // source seconds
  speed: number; // 0.5..4
  volume: number; // 0..2, 1 = unchanged
}

export interface TextClip extends ClipBase {
  type: 'text';
  text: string;
  font: string;
  size: number; // px at canvas resolution
  color: string; // #rrggbb
  align: 'left' | 'center' | 'right';
}

export type Clip = MediaClip | TextClip;

export interface Transition {
  leftClipId: Id;
  rightClipId: Id;
  type: 'fade' | 'dissolve' | 'slideleft' | 'wipeleft'; // map 1:1 to ffmpeg xfade names
  duration: number; // seconds; <= min(left, right) clip duration
}
