# Deploy: Reelwright 0.1.0 (Windows desktop)

"Live" for this app = a Windows installer on the user's machine. No host, domain, DNS, database, Stripe, OAuth or email.

## Preflight (2026-11-19)

| check | result |
| --- | --- |
| e2e (`npx playwright test`) against dev build | 3/3 passed |
| e2e against the **packaged** app (`E2E_EXE=dist/win-unpacked/Reelwright.exe`) | 3/3 passed, including a real export through the asar-unpacked ffmpeg |
| unit + real-render tests (`npm test`) | 10/10 passed |
| typecheck (`tsc --noEmit`) | clean |
| parity (`parity.py`) | 91.7, must-haves 17/17 |
| rebrand sweep (`sweep.py --config replica/brand.json`) | clean, exit 0 |
| store listing (`listing.py`) | n/a, no store |
| open S1/S2 bugs (`bugs.md`) | none |
| privacy policy / terms / cookies / account deletion | n/a: nothing leaves the machine, no accounts |
| title + window name | "Reelwright" |
| app icon | **still Electron's default**; logo not made (brand.md brief) |
| code signing | **not signed**: Windows SmartScreen shows "unknown publisher" on first run. Fine for your own machine. Sign before giving it to anyone else |

## Artifact

`dist/Reelwright Setup 0.1.0.exe` (219 MB, NSIS, per-user install). `dist/` is git-ignored; rebuild with `npm run dist`.
Size note: ffprobe-static bundles binaries for every OS. Excluding the mac/linux ones would cut roughly 100 MB (not done).
Build note: `win.signAndEditExecutable: false` avoids electron-builder's winCodeSign download, which needs symlink rights (Developer Mode) on Windows.

## Install

Run the installer yourself (it is your machine). Data lives in `%APPDATA%\reelwright\projects\` (one folder per project; `project.json` + `.bak` + thumbnails).
Back that folder up with the rest of your files. Media is referenced in place, never copied.

## What to watch in the first week

- Exports of real footage (phone HEVC, 4K): speed and whether the preview plays it (bugs.md "to check").
- The manual cases in test-plan.md: drag-trim, drag-reorder, overlay overlap, moved media.
- Any "Autosave failed" toast. That's the one error that can cost work.
