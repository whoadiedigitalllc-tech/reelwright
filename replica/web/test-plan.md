# Test plan (web)

Run: `npm run web:e2e` (builds dist-web, serves it, drives Chromium). Shared logic is covered by `npm test`;
desktop by `npm run e2e`. Every web spec fails on console errors and runs axe-core on each screen.

| case | what | how | result |
| --- | --- | --- | --- |
| W-F01-H1 | import a video + image through the file picker (loads ffmpeg.wasm), add both, split, add text, chroma key, export 720p, download is a 7s MP4 | e2e | pass (whole test 18-29s) |
| W-F01-H2 | preview draws real frames from browser storage | e2e (canvas pixels) | pass |
| W-F01-N2 | `.txt` rejected with an error toast | e2e | pass |
| W-F02-H1 | project and media survive a page reload; nothing shows as missing | e2e | pass |
| W-S01 | delete removes the project and its stored media | e2e (UI) | pass; storage cleanup by key range is in code, not measured |
| W-S09 | "Show in folder" hidden on the web | e2e | pass |
| W-S11 | 390px window shows the notice; back to 1440 restores the editor | e2e | pass |
| W-probe | `ffmpeg -i` parser: video+audio, silent video, audio only, image | unit, real ffmpeg output | pass |
| W-E1 | storage quota full on import | code path (QuotaExceededError -> toast) | manual: not run |
| W-E2 | cancel export (terminates the worker; next export reloads it) | code path | manual: not run |
| W-E3 | Firefox / Safari | - | not run (Chromium only) |
| W-E4 | long 4K export (wasm memory) | - | not run; expected to fail on long 4K (architecture.md) |
| shared | desktop e2e after the Api refactor | `npm run e2e` | pass (3/3) |
