# Recon map: CapCut (desktop, rebuilt as Electron)

Scope: core video editor. Import clips, multi-track timeline (trim/split/reorder), text overlays, basic transitions, export MP4.
For: the user's own business content (single user, local files, no accounts).
Date: 2026-11-19

## Sources

Public sources only. No account used, no app binaries or network traffic inspected.
All rows are marked (memory): drawn from general public knowledge of the product, NOT re-read this session. Verify details against them before relying on them.

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | help center | https://www.capcut.com/help | feature list, editor basics (memory) |
| 2 | desktop marketing page | https://www.capcut.com/tools/desktop-video-editor | pitch, core loop (memory) |
| 3 | pricing / Pro | https://www.capcut.com/pricing | Pro gates effects, AI, cloud (memory) |
| 4 | Microsoft Store listing | https://apps.microsoft.com (search "CapCut") | screenshots of editor layout (memory) |
| 5 | public walkthrough videos | YouTube "CapCut PC tutorial for beginners" | click-by-click flows (memory) |

## Core loop

Drop clips in, cut them on a timeline, add text, export a finished MP4.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Home | app launch | start or reopen a project | New project button, project grid cards | empty, filled |
| S02 | Editor shell | New project / open card | the 4-pane workspace | top bar (name, export), left asset tabs, player, inspector, timeline | empty project, filled |
| S03 | Media panel | S02 left tab "Media" | import and hold files | import button, drop zone, asset tiles (thumb + duration) | empty, importing, filled, unsupported-file error, offline |
| S04 | Text panel | S02 left tab "Text" | add text clips | "Default text" tile, style presets | filled |
| S05 | Transitions panel | S02 left tab "Transitions" | add between clips | transition tiles | filled |
| S06 | Player | S02 center | preview the composition | canvas, play/pause, timecode, aspect ratio menu | empty (black), playing, paused |
| S07 | Inspector | S02 right, when a clip is selected | edit clip properties | sliders, number inputs, color picker | nothing selected, video clip, text clip |
| S08 | Timeline | S02 bottom | arrange clips in time | toolbar (undo, redo, split, delete), ruler, tracks, playhead, zoom, snap | empty ("drag media here"), filled, clip selected, dragging |
| S09 | Export dialog | S02 top bar "Export" | render to file | name, location, resolution, fps, export button, progress bar | settings, exporting, done (open folder), error |
| S10 | Settings | S01 gear | defaults | save location, autosave | default |

## Flows

```
F01 Make a short video from scratch
    S01 New project -> S02 -> S03 Import (pick files) -> drag clip to S08
    -> move playhead, Split -> Delete bad part -> S04 add text -> S07 edit text
    -> S09 Export -> done
    happy path clicks: ~12 (number to beat)
    edge: unsupported codec, huge 4K file (slow preview), mixed aspect ratios,
          zero clips at export, disk full on export

F02 Reopen and continue
    S01 click project card -> S02 (restored timeline + media)
    happy path clicks: 1
    edge: source file moved/deleted (media offline), corrupt project file

F03 Tighten a clip
    S08 select clip -> drag edge to trim / drag body to reorder -> S06 preview
    happy path: 2 drags
    edge: trim below 1 frame, drop overlapping another clip, snap to playhead

F04 Add a transition
    S05 drag tile onto the cut between two clips -> S07 set duration
    happy path clicks: 2
    edge: clips shorter than transition, cut at track start

F05 Change output format
    S06 aspect ratio 16:9 -> 9:16 -> S07 reposition clips -> S09 export
    edge: letterbox vs fill
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary (Export), secondary, ghost/icon | default, hover, focus, disabled, loading | all |
| Tab rail | vertical icon+label | default, active | S02 left |
| Asset tile | video, image, audio, text preset, transition | default, hover, dragging, error/offline | S03, S04, S05 |
| Project card | - | default, hover (rename, delete) | S01 |
| Slider + number input | - | default, focus, disabled | S07 |
| Color picker | swatch + hex | default, open | S07 |
| Dropdown | - | closed, open | S06, S09 |
| Timeline clip | video, audio, text, image | default, selected, trimming, dragging | S08 |
| Playhead | - | idle, scrubbing | S06, S08 |
| Modal | dialog | open, busy | S09, confirm delete |
| Toast | info, error | - | import errors, export done |
| Progress bar | determinate | - | S03, S09 |

## Inferred data model

Local-first: CapCut desktop keeps each project as a draft folder with a JSON file on disk (confidence: medium).

```
Project     id, name, created_at, updated_at, canvas_w, canvas_h, fps, thumbnail_path
            evidence: S01 cards (name, date, thumbnail, duration), S06 aspect menu
            confidence: high

MediaAsset  id, project_id, path, kind (video|audio|image), duration, width, height, has_audio
            evidence: S03 tiles show thumb + duration; "media offline" on moved files
            confidence: high

Track       id, project_id, kind (video|audio|text), order, muted, hidden
            evidence: S08 track headers with mute/hide icons
            confidence: high

Clip        id, track_id, asset_id (null for text), start, in, out, speed, volume,
            transform {x, y, scale, rotation, opacity}
            evidence: S07 property tabs, S08 trim handles
            confidence: high

TextClip    (Clip with) text, font, size, color, align
            evidence: S04, S07 text tab
            confidence: high

Transition  track_id, left_clip_id, right_clip_id, type, duration
            evidence: S05, S07
            confidence: medium (may live on the right clip instead - guess)
```

Relationships: Project 1-n MediaAsset, Project 1-n Track, Track 1-n Clip, Clip n-1 MediaAsset, Track 1-n Transition.

## Feature matrix

See `features.csv`. Must: 18, should: 7, could: 5, skip: 6.

## Out of scope (cannot or should not be cloned)

- Music, sound-effect, sticker, effect, filter and template libraries: licensed/owned content.
- Cloud space, team collaboration, accounts, Pro subscription: not needed for a single-user tool.
- Direct publish to TikTok/YouTube: partner integrations; export a file instead.
- Background removal; auto captions deferred to "could".
- CapCut's name, logo, icons, UI copy and visual identity: patterns only (see /replica-brand).

## Size

Screens 10, flows 5, entities 6. Hard parts:
1. Frame-accurate multi-track preview in real time (video elements + canvas compositing, seek lag).
2. Export: turning the timeline into an ffmpeg filter graph (trim, concat, overlay, drawtext, xfade, speed).
3. Timeline UX: drag, trim, snap, zoom, undo/redo.

Size: M (a few weeks) for this slice. Full CapCut would be XL.
