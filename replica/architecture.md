# Architecture: desktop video editor (a rebuild of CapCut's core editor)

Single user, local files, offline. No server, no accounts, no payments, no email.
That deletes the auth / payments / email / jobs / hosting rows of the default stack.

## Stack

| layer | choice | why |
| --- | --- | --- |
| shell | Electron | user picked desktop; gives file system + a bundled native ffmpeg |
| build | electron-vite + TypeScript | one config for main, preload and renderer; fast HMR |
| UI | React 18 + plain CSS with tokens from replica-design | no UI kit needed for ~10 screens; tokens are CSS variables |
| state | Zustand + immer patches for undo/redo | tiny; patches give undo for free |
| storage | one JSON file per project in `<userData>/projects/<id>/project.json` | single user, whole-document saves; a database buys nothing here |
| media | ffmpeg-static + ffprobe-static (npm binaries) | probe, thumbnails, export; no system install needed |
| preview | one hidden `<video>` per visible clip, composited onto a `<canvas>` | native decode, real-time for 1080p |
| tests | Vitest (model + ffmpeg-graph builder), Playwright Electron (e2e) | covers the two risky pieces |
| packaging | electron-builder (NSIS installer) | standard Windows installer |

Not used, with reason: database (JSON doc is the unit of work), backend (offline), auth/payments/email (own business tool).

## Schema

Storage is a document, not tables. Access rules: none needed (local, single OS user).
The "schema" is the TypeScript type in `replica/schema.ts`, validated with a version field on load.

Files on disk:

```
<userData>/projects/index.json            [{id, name, updatedAt, thumb}]  (rebuilt from folders if missing)
<userData>/projects/<id>/project.json     the Project document (written atomically: tmp file + rename)
<userData>/projects/<id>/thumbs/<assetId>.jpg
```

Media files are referenced by absolute path, never copied (they can be GBs).
Times are stored in seconds as numbers; frame snapping happens at the edges (UI and export) using `project.fps`.

## API (IPC between renderer and main)

| channel | does | input | output | flow |
| --- | --- | --- | --- | --- |
| `projects:list` | list projects for S01 | - | ProjectSummary[] | F02 |
| `projects:create` | new empty project | {name?, width, height, fps} | Project | F01 |
| `projects:load` | open project, mark offline media | id | Project | F02 |
| `projects:save` | atomic write (debounced autosave, 1s) | Project | ok | all |
| `projects:rename` / `projects:delete` | manage from S01 | id, name? | ok | - |
| `media:pick` | native open dialog | - | paths[] | F01 |
| `media:probe` | ffprobe + thumbnail | path | MediaAsset or error | F01 |
| `export:start` | build filter graph, run ffmpeg | {projectId, outPath, width, height, fps} | jobId | F01, F05 |
| `export:progress` (event) | percent from ffmpeg `-progress` | - | {jobId, pct} | F01 |
| `export:cancel` | kill ffmpeg, remove partial file | jobId | ok | F01 |
| `shell:reveal` | open output folder | path | - | F01 |

Webhooks: none. Jobs: none (export is a child process tied to the window).
Renderer reads media via a custom `media://` protocol registered in main, so the renderer never gets raw `file://` access.

## The parts that bite

- timing precision: seconds as floats drift; snap every edit to `1/fps` and use `-ss` after `-i` only where frame accuracy matters.
- races: autosave during export; export reads a snapshot of the document, not live state.
- data loss: atomic write (write `project.json.tmp`, then rename); keep `project.json.bak` of the last good save.
- file size limits: never load media into JS memory; stream via `media://` with range requests.
- offline media: missing path on load -> asset `offline: true`, red tile, "relink" action; export refuses with a clear error.
- codecs: Chromium can't play every codec (e.g. HEVC on some machines, ProRes); probe flags it, preview shows a placeholder, export still works via ffmpeg.
- security: `contextIsolation: true`, `nodeIntegration: false`, narrow preload API; ffmpeg args as an array (no shell), text for `drawtext` escaped or passed via `textfile=`.
- performance: >3 simultaneous 4K videos will stutter in preview; acceptable for v1 (proxies are a later fix).

## Build order

1. Vertical slice: S01 (one button), S02 shell, S03 import, S08 one video track (drop, play), S09 export of that track. Channels: projects:create/save, media:pick/probe, export:start/progress. Proves Electron + ffmpeg + preview.
2. Must-haves: S01 list/reopen, split/trim/delete/reorder, multi-track + overlay, text (S04, S07), undo/redo, autosave, export dialog states.
3. Should-haves: zoom + snap, volume/mute, speed, transitions (S05), aspect ratio, transform, shortcuts.
4. Fixes from replica-entrepreneur (once it runs).
