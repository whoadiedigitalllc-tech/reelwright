# Brand: Reelwright

Angle (fixes.md, A + C): a desktop editor where every feature is free and nothing is locked at export; a tool, not a feed.
"Reelwright" = a maker of reels, like a shipwright or wheelwright: craft, not hype.

## Name

20 candidates: Openframe, Clipbench, Plainreel, Reelwright, Framewise, Splicebox, Tapeline, Vidora, Kliff, Montra, Edda,
Workbench, Marquee, Assemble, Stitch, Plainframe, Reelhouse, Cutting Room*, Freecut*, Splice*.
(*dropped at once: "cut" echoes the original; Splice is an existing video editor.)

Screened on 2026-11-19 (screening, not legal clearance):

| check | Reelwright | Plainframe | Tapeline | Framewise | Montra |
| --- | --- | --- | --- | --- | --- |
| iOS App Store exact name | none found | none found | "Tapeline: Body Measurement Log" (other category) | "Framewise" exists | "Montra: Photo & Video Collage" (conflict) |
| Mac App Store | none found | none found | none found | none found | none found |
| .com / .app (DNS NS records) | registered / registered | registered / registered | registered / registered | registered / registered | registered / registered |
| .io | no NS records | no NS records | registered | registered | registered |
| github.com/<name> | taken | taken | taken | taken | taken |
| USPTO (class 9, 42) | to run | to run | to run | to run | to run |
| EUIPO / TMview | to run | to run | to run | to run | to run |
| Canada (CIPO) | to run | to run | to run | to run | to run |
| WIPO Global Brand DB | to run | to run | to run | to run | to run |
| Google Play exact name | to run | to run | to run | to run | to run |
| X / Instagram / TikTok handles | to run | to run | to run | to run | to run |

**Chosen: Reelwright** (by the user). For internal use the open checks don't block anything. Before any public release,
run the trademark searches, and have a lawyer clear the name before spending money on it.

## Palette

The original's identity is black and white with cyan highlights. Reelwright keeps neutral darks (an editor needs them)
and uses a warm amber accent, far from the blue and cyan family.

| role | value |
| --- | --- |
| accent | #f0a33c (amber) |
| on-accent | #17110a |
| bg / surface / surface-2 | #111214 / #1b1c1f / #25262a |
| clip video / audio / text | #2b4560 / #2a5444 / #5e3d55 |
| danger | #ff7a7a |

Contrast: 18 pairs, 0 AA failures (`contrast.py replica/design/tokens.json`).
`brand.json` lists no original colours: their exact hex values were never measured, so the sweep checks name and domain only.

## Logo brief

- Idea: a film strip bent into a carpenter's square. Craft tools for video.
- Mark: symbol plus wordmark; the symbol alone is the app icon.
- Wordmark: Inter Bold or a sturdy grotesque; lowercase "reelwright".
- Colours: amber symbol on #111214; one-colour version for 16px.
- Must work at 16px (favicon: the square only, no sprocket holes) and as a 1024px icon.
- Deliverables: SVG (symbol, wordmark, lockup), 1024x1024 icon with no transparency, .ico (16/32/48/256) for Windows, 1200x630 social image.
- Must not resemble the original's mark: no black-white two-tone glyph, no interlocking letterforms, no cyan.
- Status: not made. The app currently uses Electron's default icon.

## Voice: plain, warm, exact

- **Plain**, not bland: short words, no hype, no "AI-powered".
- **Warm**, not cute: talks like a helpful colleague; no exclamation marks in errors.
- **Exact**, not technical: says what happened and what to do, in user terms.

| do | don't |
| --- | --- |
| "Couldn't import notes.txt: this file type is not supported." | "Oops! Something went wrong 😅" |
| "Saved" | "Your masterpiece is safe in the cloud!" |
| "Export video" | "Unlock HD export with Pro" |
| "Your original media files are not touched." | "Are you sure? This cannot be undone!!!" |
| "Select a clip to edit it." | "Nothing to see here 👀" |

## The 10 most-seen strings (all written fresh for this app)

| where | string |
| --- | --- |
| S01 title | Projects |
| S01 empty | No projects yet. Start one to begin editing. |
| S01 main button | New project |
| S01 delete confirm | "{name}" will be removed. Your original media files are not touched. |
| S03 empty | Drop video, audio or images here, or click Import. |
| S08 empty | Drag clips from Media to start your timeline. |
| S07 empty | Select a clip to edit it. |
| S09 button | Choose file and export |
| S09 done | Saved to {path} |
| import error | Couldn't import {file}: {reason} |

## Sweep

`sweep.py . --config replica/brand.json` → clean (2026-11-19).
Note: the project folder itself is still called `capcut-clone`. Rename it to `reelwright` when no editor or terminal has it open.
