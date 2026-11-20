# Recon map: CapCut web editor (web)

Scope: the same core-editor slice as the desktop rebuild (../recon.md), running in a desktop browser.
For: the user's own business. Single user, no accounts.
Date: 2026-11-19

This is a delta. Screens S02 to S09, flows F01 to F05, components and the data model are the same as the desktop map
(the web editor has the same four-pane workspace). Only what changes on the web is listed here.

## Sources

Public sources only; nothing logged into. All rows are (memory): general public knowledge, not re-read this session.

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | web editor entry | https://www.capcut.com/editor | sign-in wall before the editor (memory) |
| 2 | help center | https://www.capcut.com/help | web editor basics, upload limits (memory) |
| 3 | pricing | https://www.capcut.com/pricing | cloud storage and Pro gating (memory) |
| 4 | walkthrough videos | YouTube "CapCut online editor tutorial" | flows (memory) |

## Core loop

Same as desktop: drop clips in, cut them on a timeline, add text, export an MP4. On the web the files come from the computer, and the MP4 comes back as a download.

## What changes on the web

| ID | screen | change vs desktop | states |
| --- | --- | --- | --- |
| S00 | Sign-in wall | original requires an account before editing | skip: no accounts |
| S01 | Home / projects | original lists cloud projects; clone lists projects stored in this browser | empty, filled |
| S03 | Media / upload | original uploads to cloud with per-file progress; clone stores files in the browser | empty, importing, filled, unsupported, storage full |
| S09 | Export | original renders server-side then offers download (guess); clone renders in the tab and downloads | settings, exporting, done, error, cancelled |
| S11 | Narrow-screen notice | editor needs a wide window | phone width |

## Flows (web differences)

```
F01 Make a short video: same path; "export" ends in a browser download instead of a save dialog.
    edge (web): tab closed mid-export (lost, re-run), storage quota full on import, very large source files (memory limit)
F02 Reopen: projects reopen from browser storage after a reload or a browser restart.
    edge (web): browser data cleared (projects gone), private window (not kept)
```

## Data model (web differences)

Project document is unchanged. MediaAsset.path becomes a storage key (`<projectId>/<assetId>/<filename>`) instead of a file path.
The file itself is stored as a Blob in IndexedDB, and the thumbnail as a data URL. Confidence: n/a (this is the clone's design, not an inference).

## Out of scope

Same as desktop, plus: sign-in, cloud space, sync between devices, sharing links, team spaces (they need a backend and accounts).

## Size

Reuses the desktop UI and timeline logic. The new work is an alternative to the Electron main process:
browser storage, ffmpeg in WebAssembly (probe, thumbnails, export), and text rendered as images (no system fonts in the browser's ffmpeg).
Hard parts: 1) ffmpeg.wasm memory and speed limits; 2) keeping big media in browser storage without eviction; 3) the in-browser export pipeline.
Size: S to M on top of the desktop build.
