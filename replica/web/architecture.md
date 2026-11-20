# Architecture: Reelwright web (a rebuild of CapCut's web editor core)

Same repo as the desktop app. The React renderer (src/renderer), the timeline logic (src/shared/ops.ts), the project
schema and the ffmpeg graph builder (src/main/exportArgs.ts) are shared unchanged. The web build swaps one thing:
the `window.api` object, which on desktop is the Electron preload talking to the main process.

```
src/shared/api.ts      the Api interface both platforms implement
src/preload/index.ts   desktop Api: IPC to Electron main (unchanged behaviour)
src/web/api.ts         web Api: IndexedDB + ffmpeg.wasm + downloads
src/web/main.ts        sets window.api, then boots the shared renderer
vite.web.config.ts     static build to dist-web/
```

## Stack

| layer | choice | why |
| --- | --- | --- |
| app | the existing React renderer | one UI for both platforms |
| build | Vite (already installed) | static output, no server |
| storage | IndexedDB: `projects` store (Project docs), `media` store (File blobs) | stores large Blobs, no server, survives restarts; `navigator.storage.persist()` asked on first import so the browser won't evict it |
| media engine | @ffmpeg/ffmpeg + @ffmpeg/core (single-thread WebAssembly) | runs the same `buildExportArgs` graph as desktop; reads codecs the browser can't play; no COOP/COEP headers needed |
| file access | WORKERFS mounts | ffmpeg reads Blobs in place, no copy into wasm memory |
| text in export | text rendered to a transparent PNG with the preview's own canvas code, overlaid by ffmpeg | the browser's ffmpeg has no system fonts; also makes export match the preview exactly (rotation included) |
| download | `<a download>` with an object URL | |
| hosting | any static host (decided at deploy) | no backend |
| tests | Vitest (shared), Playwright Chromium against `vite preview` | |

No database server, auth, payments, email or jobs (same reasons as desktop).

## Schema

Project document unchanged. On the web, `MediaAsset.path` is a storage key `<projectId>/<assetId>/<filename>`
(the filename keeps tile labels working) and `thumb` is a `data:` URL.
Deleting a project deletes `projects/<id>` and the key range `media/<id>/…`.

## API (web implementation of the same interface)

| method | web behaviour |
| --- | --- |
| listProjects / createProject / loadProject / saveProject / renameProject / deleteProject | IndexedDB; load creates object URLs for media and marks missing blobs offline |
| pickMedia | hidden `<input type=file multiple>`; resolves keys for the chosen Files ([] on cancel) |
| pathForFile | registers a dropped File, returns its key |
| probe | ffmpeg.wasm `-i` log parse (duration, size, audio), thumbnail frame, stores the Blob |
| exportVideo | mounts used Blobs, renders text PNGs, runs `buildExportArgs`, downloads the MP4 |
| cancelExport | `ffmpeg.terminate()`; reloads on next use |
| onExportProgress | parses `out_time_us` from ffmpeg's progress output (same as desktop) |
| mediaUrl | key -> object URL (desktop keeps `media://`) |
| reveal | absent on the web (UI hides "Show in folder") |

## The parts that bite

- wasm memory: single-thread ffmpeg.wasm is limited (~2 GB address space) and slower than native, roughly 5-20x. Long 4K exports may fail; 1080p short-form is the target.
- storage eviction: without persist() the browser may clear IndexedDB under disk pressure. Persist is requested; the UI says where projects live.
- quota: importing beyond quota throws QuotaExceededError -> error toast, nothing saved half-way.
- one ffmpeg at a time: probe and export are queued.
- tab closed mid-export: the export is lost; re-run it (no server).
- CSP: needs `blob:` for media, workers and the wasm core, plus `'wasm-unsafe-eval'`.

## Build order

1. Shared `Api` interface; preload typed against it (no behaviour change; desktop tests stay green).
2. Web Api: storage + import + preview (vertical slice: import a clip, see it play).
3. Export in wasm with text-as-image; download.
4. Narrow-screen notice; web e2e.
