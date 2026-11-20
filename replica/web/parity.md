# Parity report: web (2026-11-19)

**Verdict: shippable** for its own-business use. Must-haves 21/21, feature score 93.0, no open S1/S2.

| measure | score | note |
| --- | --- | --- |
| feature parity | 93.0 | `parity.py replica/web/features.csv` (shared rows take the desktop result: same code) |
| layout per screen | not measured | no reference screenshots of CapCut's web editor in `replica/screens/` (it sits behind a sign-in) |

## Missing, in build order

Same as desktop (../parity.md): crossfade/slide transitions, text rotation, colour adjust, crop, freeze frame, auto captions.

## Behaviour differences

| flow | original (memory) | clone | fix or keep |
| --- | --- | --- | --- |
| start | sign in first | straight to projects, no account | keep (fix 3) |
| import | upload to cloud, wait on upload progress | stays in the browser; first import loads the engine (~32 MB, cached after) | keep; consider a one-line "loading editor engine" hint |
| export | rendered remotely, then download (guess) | rendered in the tab: slower on long or 4K videos, works offline | keep; long 4K is a known limit |
| reopen | any device | this browser only; clearing site data deletes projects | keep; say so in the UI (next) |
| narrow screens | desktop-only editor | clear notice under 1000px | keep |

## Next five

1. A visible note on Home: "Projects are saved in this browser." (data-loss expectation)
2. Crossfade transitions (xfade) on the main track
3. Text rotation (easy on the web now that export renders text with the preview's canvas code)
4. Colour adjust (`eq` filter + canvas `filter`)
5. Proxy previews for 4K/HEVC
