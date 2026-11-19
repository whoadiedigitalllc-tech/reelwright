# Test plan

Automated: `npm test` (Vitest: timeline ops + a real ffmpeg render) and `npm run e2e` (Playwright driving the built Electron app;
OS file dialogs stubbed in the main process; every spec fails on console errors and runs axe-core on each screen).

| case | what | how | result |
| --- | --- | --- | --- |
| F01-H1 | new project -> import video + image -> add both -> add text -> export 720p -> file is 7s | e2e | pass |
| F01-H2 | preview draws real video frames (canvas pixels lit) | e2e | pass |
| F01-E1 | emoji and accents in text (`Summer sale – 50% off ☀️`) preview + export | e2e + unit (`It's 50%: done` through drawtext) | pass |
| F01-E2 | mixed aspect ratios (640x360 video + 300x300 image on a 9:16 canvas) | unit render | pass |
| F01-E3 | keyboard only: Space, S, Delete, Ctrl+Z, arrows | e2e (keys) | pass |
| F01-N1 | export with an empty timeline is blocked | e2e (button disabled) + unit (throws) | pass |
| F01-N2 | unsupported file (`.txt`) shows an error, imports nothing | e2e | pass (after fix B03) |
| F01-N3 | missing media at export -> clear error, no partial file | code path (throws before ffmpeg; output removed on failure) | manual: not run |
| F01-N4 | disk full / ffmpeg fails mid-export -> error, partial file removed | code path | manual: not run |
| F02-H1 | reopen project restores clips and text | e2e | pass |
| F02-E1 | source file moved -> "Missing" badge + toast | code path | manual: not run |
| F02-E2 | corrupt project.json -> falls back to .bak | code path | manual: not run |
| F03-H1 | split keeps length, in-point offset | unit | pass |
| F03-H2 | delete on main track ripples | unit + e2e | pass |
| F03-H3 | drag reorder on main track | unit (moveMain) | pass; pointer drag manual: not run |
| F03-E1 | trim can't go below 1 frame or past source end | code (clamp) | manual: not run |
| F03-E2 | drop onto an occupied overlay spot reverts + toast | code | manual: not run |
| F04-H1 | fade in/out / dip to black render (video alpha + afade) | unit render | pass |
| F05-H1 | 9:16 canvas exports 360x640 at 360p | unit render | pass |
| S01 | rename with a 60-char name, delete with confirm, media untouched | e2e | pass |
| a11y | axe on S01 empty/filled, S02 empty/filled, S07 text, S09 | e2e | pass (after B01, B02) |

Not applicable for this app: second user's data, sessions, payments, time zones, network.
Totals: 21 cases, 14 automated and passing, 7 manual-only not yet run.
