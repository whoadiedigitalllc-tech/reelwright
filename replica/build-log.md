# Build log

| screen | date | status | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S01 Home | 2026-11-19 | done | search (not needed yet) | - |
| S02 Editor shell | 2026-11-19 | done | resizable panes | - |
| S03 Media | 2026-11-19 | done | relink missing media | ffprobe accepts .txt (B03) |
| S04 Text | 2026-11-19 | done | bold/stroke/background styles | - |
| S05 Transitions | 2026-11-19 | partial | crossfade/slide/wipe (only fades + dip to black) | dropped the Transition entity for per-clip fades: survives split/delete with no bookkeeping |
| S06 Player | 2026-11-19 | done | fullscreen | canvas taint via custom protocol (B04) |
| S07 Inspector | 2026-11-19 | done | text rotation | - |
| S08 Timeline | 2026-11-19 | done | per-clip keyboard nudge | magnetic main track + free overlay tracks |
| S09 Export | 2026-11-19 | done | - | text through drawtext needs Windows font files |
| S10 Settings | - | not built | whole screen | not in the feature matrix; nothing to configure yet |

Must-haves: 18/18. Should: 6 yes + 1 partial of 7. Could: 1 of 5.
